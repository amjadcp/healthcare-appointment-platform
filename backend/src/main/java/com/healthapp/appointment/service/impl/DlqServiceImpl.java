package com.healthapp.appointment.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthapp.appointment.config.RabbitMQConfig;
import com.healthapp.appointment.dto.response.DlqMessageResponse;
import com.healthapp.appointment.service.DlqService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import com.rabbitmq.client.GetResponse;
import com.rabbitmq.client.AMQP;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Queries the RabbitMQ Management HTTP API to peek at DLQ messages
 * without consuming them. Uses ackmode=ack_requeue_true so messages
 * are immediately re-queued after peeking — zero message loss.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DlqServiceImpl implements DlqService {

    @Value("${rabbitmq.management.host:localhost}")
    private String mgmtHost;

    @Value("${rabbitmq.management.port:15672}")
    private int mgmtPort;

    @Value("${spring.rabbitmq.username:guest}")
    private String mgmtUser;

    @Value("${spring.rabbitmq.password:guest}")
    private String mgmtPassword;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final RabbitTemplate rabbitTemplate;

    /** Build a Basic Auth header for the Management API. */
    private HttpHeaders buildAuthHeaders() {
        String credentials = mgmtUser + ":" + mgmtPassword;
        String encoded = Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + encoded);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private List<DlqMessageResponse> peekDlqMessagesRaw(int count) {
        String vhost = URLEncoder.encode("/", StandardCharsets.UTF_8);
        String queue = URLEncoder.encode(RabbitMQConfig.DLQ_QUEUE, StandardCharsets.UTF_8);
        String url = String.format("http://%s:%d/api/queues/%s/%s/get", mgmtHost, mgmtPort, vhost, queue);
        URI uri = URI.create(url);

        // ackmode=ack_requeue_true: messages are acknowledged then immediately re-queued.
        // This is a "peek" — no message is permanently removed from the DLQ.
        String requestBody = String.format(
                "{\"count\": %d, \"ackmode\": \"ack_requeue_true\", \"encoding\": \"auto\", \"truncate\": 50000}",
                Math.min(count, 100)
        );

        HttpEntity<String> entity = new HttpEntity<>(requestBody, buildAuthHeaders());

        try {
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.POST, entity, String.class);
            List<Map<String, Object>> rawMessages = objectMapper.readValue(
                    response.getBody(), new TypeReference<List<Map<String, Object>>>() {}
            );

            List<DlqMessageResponse> results = new ArrayList<>();
            int pos = 1;
            for (Map<String, Object> msg : rawMessages) {
                results.add(mapToResponse(pos++, msg));
            }
            return results;

        } catch (RestClientException e) {
            log.error("Failed to query RabbitMQ Management API for DLQ messages: {}", e.getMessage());
            return List.of();
        } catch (Exception e) {
            log.error("Failed to parse DLQ messages from Management API: {}", e.getMessage(), e);
            return List.of();
        }
    }

    @Override
    public List<DlqMessageResponse> peekDlqMessages(int count, String orgSlug) {
        List<DlqMessageResponse> allMessages = peekDlqMessagesRaw(1000);
        List<DlqMessageResponse> filtered = new ArrayList<>();
        for (DlqMessageResponse msg : allMessages) {
            String msgOrgSlug = extractOrgSlugFromResponse(msg);
            if (orgSlug != null && orgSlug.equals(msgOrgSlug)) {
                filtered.add(msg);
                if (filtered.size() >= count) {
                    break;
                }
            }
        }
        return filtered;
    }

    @Override
    public long getDlqMessageCount(String orgSlug) {
        List<DlqMessageResponse> allMessages = peekDlqMessagesRaw(1000);
        long count = 0;
        for (DlqMessageResponse msg : allMessages) {
            String msgOrgSlug = extractOrgSlugFromResponse(msg);
            if (orgSlug != null && orgSlug.equals(msgOrgSlug)) {
                count++;
            }
        }
        return count;
    }

    private String extractOrgSlugFromResponse(DlqMessageResponse msg) {
        Object payloadObj = msg.getPayload();
        if (payloadObj instanceof Map) {
            Map<?, ?> envelope = (Map<?, ?>) payloadObj;
            
            // Check for explicit worker DLQ wrap
            if (envelope.containsKey("originalEvent")) {
                Object original = envelope.get("originalEvent");
                if (original instanceof Map) {
                    Map<?, ?> origMap = (Map<?, ?>) original;
                    if (origMap.containsKey("payload")) {
                        Object innerPayload = origMap.get("payload");
                        if (innerPayload instanceof Map) {
                            Map<?, ?> innerMap = (Map<?, ?>) innerPayload;
                            if (innerMap.containsKey("orgSlug")) {
                                return String.valueOf(innerMap.get("orgSlug"));
                            }
                        }
                    }
                }
            }
            
            if (envelope.containsKey("payload")) {
                Object innerPayload = envelope.get("payload");
                if (innerPayload instanceof Map) {
                    Map<?, ?> innerMap = (Map<?, ?>) innerPayload;
                    if (innerMap.containsKey("orgSlug")) {
                        return String.valueOf(innerMap.get("orgSlug"));
                    }
                }
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private DlqMessageResponse mapToResponse(int position, Map<String, Object> rawMsg) {
        String exchange   = String.valueOf(rawMsg.getOrDefault("exchange", ""));
        String routingKey = String.valueOf(rawMsg.getOrDefault("routing_key", ""));
        Map<String, Object> properties = (Map<String, Object>) rawMsg.getOrDefault("properties", Map.of());
        Map<String, Object> headers    = (Map<String, Object>) properties.getOrDefault("headers", Map.of());

        // Parse payload
        Object payload = rawMsg.get("payload");
        if (payload instanceof String) {
            try {
                payload = objectMapper.readValue((String) payload, Object.class);
            } catch (Exception ignored) {
                // Keep as string if not valid JSON
            }
        }

        // Parse x-death entries for provenance
        List<DlqMessageResponse.DeathEntry> deaths = new ArrayList<>();
        Object xDeath = headers.get("x-death");
        if (xDeath instanceof List<?>) {
            for (Object entry : (List<?>) xDeath) {
                if (entry instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> deathMap = (Map<String, Object>) entry;
                    deaths.add(new DlqMessageResponse.DeathEntry(
                            String.valueOf(deathMap.getOrDefault("queue", "")),
                            String.valueOf(deathMap.getOrDefault("reason", "")),
                            String.valueOf(deathMap.getOrDefault("exchange", "")),
                            deathMap.get("count") instanceof Number n ? n.longValue() : 0L,
                            String.valueOf(deathMap.getOrDefault("time", ""))
                    ));
                }
            }
        }

        return new DlqMessageResponse(position, exchange, routingKey, headers, payload, deaths);
    }

    @Override
    public boolean reprocessMessage(String eventId, String orgSlug) {
        return rabbitTemplate.execute(channel -> {
            boolean found = false;
            long messageCount = channel.queueDeclarePassive(RabbitMQConfig.DLQ_QUEUE).getMessageCount();
            
            for (long i = 0; i < messageCount; i++) {
                GetResponse response = channel.basicGet(RabbitMQConfig.DLQ_QUEUE, false);
                if (response == null) {
                    break;
                }
                
                byte[] body = response.getBody();
                String bodyStr = new String(body, StandardCharsets.UTF_8);
                String msgEventId = extractEventId(bodyStr);
                
                if (eventId.equals(msgEventId)) {
                    String msgOrgSlug = extractOrgSlugFromBody(bodyStr);
                    if (orgSlug == null || !orgSlug.equals(msgOrgSlug)) {
                        log.warn("Organization mismatch: User org={} tried to reprocess message org={}", orgSlug, msgOrgSlug);
                        channel.basicPublish(RabbitMQConfig.DLQ_EXCHANGE, RabbitMQConfig.DLQ_ROUTING_KEY, response.getProps(), response.getBody());
                        channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                        continue;
                    }
                    
                    // Reprocess: publish original event back to main topic exchange
                    String originalEventJson = extractOriginalEventJson(bodyStr);
                    String eventType = extractEventType(bodyStr);
                    String routingKey = getRoutingKey(eventType);
                    
                    if (routingKey != null) {
                        AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
                                .contentType("application/json")
                                .deliveryMode(2) // persistent
                                .build();
                        channel.basicPublish(RabbitMQConfig.EXCHANGE_NAME, routingKey, props, originalEventJson.getBytes(StandardCharsets.UTF_8));
                        log.info("Reprocessed DLQ event {} to routing key {}", eventId, routingKey);
                    } else {
                        log.warn("Could not determine routing key for event type {} of event {}", eventType, eventId);
                    }
                    
                    channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                    found = true;
                } else {
                    // Move message to the tail of the DLQ to inspect the next ones
                    channel.basicPublish(RabbitMQConfig.DLQ_EXCHANGE, RabbitMQConfig.DLQ_ROUTING_KEY, response.getProps(), response.getBody());
                    channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                }
            }
            return found;
        });
    }

    @Override
    public boolean dismissMessage(String eventId, String orgSlug) {
        return rabbitTemplate.execute(channel -> {
            boolean found = false;
            long messageCount = channel.queueDeclarePassive(RabbitMQConfig.DLQ_QUEUE).getMessageCount();
            
            for (long i = 0; i < messageCount; i++) {
                GetResponse response = channel.basicGet(RabbitMQConfig.DLQ_QUEUE, false);
                if (response == null) {
                    break;
                }
                
                byte[] body = response.getBody();
                String bodyStr = new String(body, StandardCharsets.UTF_8);
                String msgEventId = extractEventId(bodyStr);
                
                if (eventId.equals(msgEventId)) {
                    String msgOrgSlug = extractOrgSlugFromBody(bodyStr);
                    if (orgSlug == null || !orgSlug.equals(msgOrgSlug)) {
                        log.warn("Organization mismatch: User org={} tried to dismiss message org={}", orgSlug, msgOrgSlug);
                        channel.basicPublish(RabbitMQConfig.DLQ_EXCHANGE, RabbitMQConfig.DLQ_ROUTING_KEY, response.getProps(), response.getBody());
                        channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                        continue;
                    }
                    // Ack to remove from DLQ
                    channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                    log.info("Dismissed DLQ event {}", eventId);
                    found = true;
                } else {
                    // Move to the tail
                    channel.basicPublish(RabbitMQConfig.DLQ_EXCHANGE, RabbitMQConfig.DLQ_ROUTING_KEY, response.getProps(), response.getBody());
                    channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                }
            }
            return found;
        });
    }

    @Override
    public void reprocessAll(String orgSlug) {
        rabbitTemplate.execute(channel -> {
            long messageCount = channel.queueDeclarePassive(RabbitMQConfig.DLQ_QUEUE).getMessageCount();
            for (long i = 0; i < messageCount; i++) {
                GetResponse response = channel.basicGet(RabbitMQConfig.DLQ_QUEUE, false);
                if (response == null) {
                    break;
                }
                
                byte[] body = response.getBody();
                String bodyStr = new String(body, StandardCharsets.UTF_8);
                String msgOrgSlug = extractOrgSlugFromBody(bodyStr);
                
                if (orgSlug != null && orgSlug.equals(msgOrgSlug)) {
                    String originalEventJson = extractOriginalEventJson(bodyStr);
                    String eventType = extractEventType(bodyStr);
                    String routingKey = getRoutingKey(eventType);
                    
                    if (routingKey != null) {
                        AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
                                .contentType("application/json")
                                .deliveryMode(2)
                                .build();
                        channel.basicPublish(RabbitMQConfig.EXCHANGE_NAME, routingKey, props, originalEventJson.getBytes(StandardCharsets.UTF_8));
                    }
                    channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                    log.info("Reprocessed DLQ event {} for organization {}", extractEventId(bodyStr), orgSlug);
                } else {
                    // Move message to the tail of the DLQ
                    channel.basicPublish(RabbitMQConfig.DLQ_EXCHANGE, RabbitMQConfig.DLQ_ROUTING_KEY, response.getProps(), response.getBody());
                    channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                }
            }
            return null;
        });
    }

    @Override
    public void dismissAll(String orgSlug) {
        rabbitTemplate.execute(channel -> {
            long messageCount = channel.queueDeclarePassive(RabbitMQConfig.DLQ_QUEUE).getMessageCount();
            for (long i = 0; i < messageCount; i++) {
                GetResponse response = channel.basicGet(RabbitMQConfig.DLQ_QUEUE, false);
                if (response == null) {
                    break;
                }
                
                byte[] body = response.getBody();
                String bodyStr = new String(body, StandardCharsets.UTF_8);
                String msgOrgSlug = extractOrgSlugFromBody(bodyStr);
                
                if (orgSlug != null && orgSlug.equals(msgOrgSlug)) {
                    channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                    log.info("Dismissed DLQ event {} for organization {}", extractEventId(bodyStr), orgSlug);
                } else {
                    // Move message to the tail of the DLQ
                    channel.basicPublish(RabbitMQConfig.DLQ_EXCHANGE, RabbitMQConfig.DLQ_ROUTING_KEY, response.getProps(), response.getBody());
                    channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
                }
            }
            return null;
        });
    }

    @SuppressWarnings("unchecked")
    private String extractOrgSlugFromBody(String bodyStr) {
        try {
            Map<String, Object> map = parseMessageBody(bodyStr);
            if (map.containsKey("originalEvent")) {
                Object original = map.get("originalEvent");
                if (original instanceof Map) {
                    Map<String, Object> origMap = (Map<String, Object>) original;
                    if (origMap.containsKey("payload")) {
                        Object payload = origMap.get("payload");
                        if (payload instanceof Map) {
                            Map<String, Object> payMap = (Map<String, Object>) payload;
                            if (payMap.containsKey("orgSlug")) {
                                return String.valueOf(payMap.get("orgSlug"));
                            }
                        }
                    }
                }
            }
            if (map.containsKey("payload")) {
                Object payload = map.get("payload");
                if (payload instanceof Map) {
                    Map<String, Object> payMap = (Map<String, Object>) payload;
                    if (payMap.containsKey("orgSlug")) {
                        return String.valueOf(payMap.get("orgSlug"));
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to extract orgSlug from DLQ message body: {}", bodyStr, e);
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseMessageBody(String bodyStr) {
        try {
            return objectMapper.readValue(bodyStr, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("Failed to parse DLQ message body: {}", bodyStr, e);
            return Map.of();
        }
    }

    private String extractEventId(String bodyStr) {
        Map<String, Object> map = parseMessageBody(bodyStr);
        if (map.containsKey("originalEvent")) {
            Object original = map.get("originalEvent");
            if (original instanceof Map) {
                return String.valueOf(((Map<String, Object>) original).get("eventId"));
            }
        }
        return String.valueOf(map.get("eventId"));
    }

    private String extractEventType(String bodyStr) {
        Map<String, Object> map = parseMessageBody(bodyStr);
        if (map.containsKey("originalEvent")) {
            Object original = map.get("originalEvent");
            if (original instanceof Map) {
                return String.valueOf(((Map<String, Object>) original).get("eventType"));
            }
        }
        return String.valueOf(map.get("eventType"));
    }

    private String extractOriginalEventJson(String bodyStr) {
        try {
            Map<String, Object> map = parseMessageBody(bodyStr);
            if (map.containsKey("originalEvent")) {
                return objectMapper.writeValueAsString(map.get("originalEvent"));
            }
            return bodyStr;
        } catch (Exception e) {
            log.error("Failed to write original event JSON", e);
            return bodyStr;
        }
    }

    private String getRoutingKey(String eventType) {
        if (eventType == null) return null;
        switch (eventType) {
            case "APPOINTMENT_CONFIRMED":
            case "APPOINTMENT_CREATED":
                return RabbitMQConfig.ROUTING_KEY_CONFIRMED;
            case "APPOINTMENT_CANCELLED":
                return RabbitMQConfig.ROUTING_KEY_CANCELLED;
            case "APPOINTMENT_COMPLETED":
                return RabbitMQConfig.ROUTING_KEY_COMPLETED;
            case "APPOINTMENT_RESERVATION_RELEASED":
                return RabbitMQConfig.ROUTING_KEY_RESERVATION_RELEASED;
            case "DOCTOR_PROVISIONED":
                return RabbitMQConfig.ROUTING_KEY_DOCTOR_PROVISIONED;
            case "DOCTOR_AVAILABILITY_UPDATED":
                return RabbitMQConfig.ROUTING_KEY_AVAILABILITY_UPDATED;
            case "ORGANISATION_REGISTERED":
                return RabbitMQConfig.ROUTING_KEY_ORG_REGISTERED;
            default:
                return null;
        }
    }
}

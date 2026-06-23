package com.healthapp.appointment.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

/**
 * A single message peeked from the RabbitMQ DLQ via the Management API.
 * The payload/headers are kept as raw Map to avoid coupling to event schema.
 */
public class DlqMessageResponse {

    private int position;
    private String exchange;
    private String routingKey;
    private Map<String, Object> headers;
    private Object payload;
    private List<DeathEntry> deaths;

    public DlqMessageResponse() {}

    public DlqMessageResponse(int position, String exchange, String routingKey,
                               Map<String, Object> headers, Object payload,
                               List<DeathEntry> deaths) {
        this.position = position;
        this.exchange = exchange;
        this.routingKey = routingKey;
        this.headers = headers;
        this.payload = payload;
        this.deaths = deaths;
    }

    public int getPosition()               { return position; }
    public String getExchange()            { return exchange; }
    public String getRoutingKey()          { return routingKey; }
    public Map<String, Object> getHeaders(){ return headers; }
    public Object getPayload()             { return payload; }
    public List<DeathEntry> getDeaths()    { return deaths; }

    /** Flattened x-death entry showing where / why the message failed. */
    public static class DeathEntry {
        private String queue;
        private String reason;
        private String exchange;
        private long count;

        @JsonProperty("first-death-at")
        private String firstDeathAt;

        public DeathEntry() {}

        public DeathEntry(String queue, String reason, String exchange, long count, String firstDeathAt) {
            this.queue = queue;
            this.reason = reason;
            this.exchange = exchange;
            this.count = count;
            this.firstDeathAt = firstDeathAt;
        }

        public String getQueue()       { return queue; }
        public String getReason()      { return reason; }
        public String getExchange()    { return exchange; }
        public long getCount()         { return count; }
        public String getFirstDeathAt(){ return firstDeathAt; }
    }
}

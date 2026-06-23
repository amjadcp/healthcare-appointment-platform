package com.healthapp.appointment.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // ── Exchange ─────────────────────────────────────────────────────────────
    public static final String EXCHANGE_NAME = "appointment.events";

    // ── Routing keys (mirror docs/event-contracts.md §1.1) ───────────────────
    public static final String ROUTING_KEY_CONFIRMED              = "appointment.confirmed";
    public static final String ROUTING_KEY_CANCELLED              = "appointment.cancelled";
    public static final String ROUTING_KEY_COMPLETED              = "appointment.completed";
    public static final String ROUTING_KEY_RESERVATION_RELEASED   = "appointment.reservation.released";
    public static final String ROUTING_KEY_DOCTOR_PROVISIONED     = "doctor.provisioned";
    public static final String ROUTING_KEY_AVAILABILITY_UPDATED   = "doctor.availability.updated";
    public static final String ROUTING_KEY_ORG_REGISTERED         = "organisation.registered";

    // ── Dedicated queues ──────────────────────────────────────────────────────
    public static final String QUEUE_CONFIRMED            = "worker.appointment.confirmed";
    public static final String QUEUE_CANCELLED            = "worker.appointment.cancelled";
    public static final String QUEUE_COMPLETED            = "worker.appointment.completed";
    public static final String QUEUE_RESERVATION_RELEASED = "worker.reservation.released";
    public static final String QUEUE_DOCTOR_PROVISIONED   = "worker.doctor.provisioned";
    public static final String QUEUE_AVAILABILITY_UPDATED = "worker.availability.updated";
    public static final String QUEUE_ORG_REGISTERED       = "worker.organisation.registered";

    // ── DLQ ──────────────────────────────────────────────────────────────────
    public static final String DLQ_EXCHANGE     = "appointment.dlq.exchange";
    public static final String DLQ_ROUTING_KEY  = "appointment.dlq";
    public static final String DLQ_QUEUE        = "worker.dlq";

    // ── Retry ────────────────────────────────────────────────────────────────
    public static final String RETRY_EXCHANGE   = "appointment.retry.exchange";
    public static final String RETRY_QUEUE      = "worker.retry.queue";

    /** Messages older than 1 hour in any queue are auto-expired into DLQ. */
    private static final int MESSAGE_TTL_MS = 60 * 60 * 1000; // 1 hour

    // ── Exchange beans ────────────────────────────────────────────────────────
    @Bean
    public TopicExchange appointmentExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public DirectExchange dlqExchange() {
        return new DirectExchange(DLQ_EXCHANGE, true, false);
    }

    @Bean
    public TopicExchange retryExchange() {
        return new TopicExchange(RETRY_EXCHANGE, true, false);
    }

    // ── Queue builder helper ──────────────────────────────────────────────────

    /**
     * Creates a durable queue wired to the DLQ exchange.
     * Any message that is nack'd (requeue=false) or exceeds MESSAGE_TTL_MS
     * will be automatically routed by RabbitMQ to the DLQ without worker intervention.
     */
    private Queue mainQueue(String name) {
        return QueueBuilder.durable(name)
                .withArgument("x-dead-letter-exchange",    DLQ_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", DLQ_ROUTING_KEY)
                .withArgument("x-message-ttl",             MESSAGE_TTL_MS)
                .build();
    }

    // ── Queue beans ───────────────────────────────────────────────────────────
    @Bean public Queue queueConfirmed()           { return mainQueue(QUEUE_CONFIRMED); }
    @Bean public Queue queueCancelled()           { return mainQueue(QUEUE_CANCELLED); }
    @Bean public Queue queueCompleted()           { return mainQueue(QUEUE_COMPLETED); }
    @Bean public Queue queueReservationReleased() { return mainQueue(QUEUE_RESERVATION_RELEASED); }
    @Bean public Queue queueDoctorProvisioned()   { return mainQueue(QUEUE_DOCTOR_PROVISIONED); }
    @Bean public Queue queueAvailabilityUpdated() { return mainQueue(QUEUE_AVAILABILITY_UPDATED); }
    @Bean public Queue queueOrgRegistered()       { return mainQueue(QUEUE_ORG_REGISTERED); }

    /** The DLQ itself is a plain durable queue — no further dead-lettering. */
    @Bean public Queue queueDlq()                 { return QueueBuilder.durable(DLQ_QUEUE).build(); }

    /** The Retry queue holds failed events temporarily then dead-letters back to main exchange. */
    @Bean
    public Queue queueRetry() {
        return QueueBuilder.durable(RETRY_QUEUE)
                .withArgument("x-dead-letter-exchange", EXCHANGE_NAME)
                .build();
    }

    // ── Binding beans ─────────────────────────────────────────────────────────
    @Bean
    public Binding bindingConfirmed(TopicExchange appointmentExchange) {
        return BindingBuilder.bind(queueConfirmed()).to(appointmentExchange).with(ROUTING_KEY_CONFIRMED);
    }

    @Bean
    public Binding bindingCancelled(TopicExchange appointmentExchange) {
        return BindingBuilder.bind(queueCancelled()).to(appointmentExchange).with(ROUTING_KEY_CANCELLED);
    }

    @Bean
    public Binding bindingCompleted(TopicExchange appointmentExchange) {
        return BindingBuilder.bind(queueCompleted()).to(appointmentExchange).with(ROUTING_KEY_COMPLETED);
    }

    @Bean
    public Binding bindingReservationReleased(TopicExchange appointmentExchange) {
        return BindingBuilder.bind(queueReservationReleased()).to(appointmentExchange).with(ROUTING_KEY_RESERVATION_RELEASED);
    }

    @Bean
    public Binding bindingDoctorProvisioned(TopicExchange appointmentExchange) {
        return BindingBuilder.bind(queueDoctorProvisioned()).to(appointmentExchange).with(ROUTING_KEY_DOCTOR_PROVISIONED);
    }

    @Bean
    public Binding bindingAvailabilityUpdated(TopicExchange appointmentExchange) {
        return BindingBuilder.bind(queueAvailabilityUpdated()).to(appointmentExchange).with(ROUTING_KEY_AVAILABILITY_UPDATED);
    }

    @Bean
    public Binding bindingOrgRegistered(TopicExchange appointmentExchange) {
        return BindingBuilder.bind(queueOrgRegistered()).to(appointmentExchange).with(ROUTING_KEY_ORG_REGISTERED);
    }

    @Bean
    public Binding bindingDlq(DirectExchange dlqExchange) {
        return BindingBuilder.bind(queueDlq()).to(dlqExchange).with(DLQ_ROUTING_KEY);
    }

    @Bean
    public Binding bindingRetry(TopicExchange retryExchange) {
        return BindingBuilder.bind(queueRetry()).to(retryExchange).with("#");
    }

    // ── Message converter ─────────────────────────────────────────────────────
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}

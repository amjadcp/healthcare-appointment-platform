package com.healthapp.appointment.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
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

    // ── Exchange beans ────────────────────────────────────────────────────────
    @Bean
    public TopicExchange appointmentExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public DirectExchange dlqExchange() {
        return new DirectExchange(DLQ_EXCHANGE, true, false);
    }

    // ── Queue beans ───────────────────────────────────────────────────────────
    @Bean public Queue queueConfirmed()           { return new Queue(QUEUE_CONFIRMED,            true); }
    @Bean public Queue queueCancelled()           { return new Queue(QUEUE_CANCELLED,            true); }
    @Bean public Queue queueCompleted()           { return new Queue(QUEUE_COMPLETED,            true); }
    @Bean public Queue queueReservationReleased() { return new Queue(QUEUE_RESERVATION_RELEASED, true); }
    @Bean public Queue queueDoctorProvisioned()   { return new Queue(QUEUE_DOCTOR_PROVISIONED,   true); }
    @Bean public Queue queueAvailabilityUpdated() { return new Queue(QUEUE_AVAILABILITY_UPDATED, true); }
    @Bean public Queue queueOrgRegistered()       { return new Queue(QUEUE_ORG_REGISTERED,       true); }
    @Bean public Queue queueDlq()                 { return new Queue(DLQ_QUEUE,                  true); }

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

    // ── Message converter ─────────────────────────────────────────────────────
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}

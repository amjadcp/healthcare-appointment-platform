package com.healthapp.appointment.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "appointment.events";
    public static final String QUEUE_NAME = "worker.appointment.queue";
    public static final String ROUTING_KEY_CREATED = "appointment.created";
    public static final String ROUTING_KEY_CANCELLED = "appointment.cancelled";

    @Bean
    public TopicExchange appointmentExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Queue appointmentQueue() {
        return new Queue(QUEUE_NAME, true);
    }

    @Bean
    public Binding bindingCreated(Queue appointmentQueue, TopicExchange appointmentExchange) {
        return BindingBuilder.bind(appointmentQueue).to(appointmentExchange).with(ROUTING_KEY_CREATED);
    }

    @Bean
    public Binding bindingCancelled(Queue appointmentQueue, TopicExchange appointmentExchange) {
        return BindingBuilder.bind(appointmentQueue).to(appointmentExchange).with(ROUTING_KEY_CANCELLED);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}

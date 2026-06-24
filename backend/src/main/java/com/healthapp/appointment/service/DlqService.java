package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.response.DlqMessageResponse;
import java.util.List;

public interface DlqService {
    /**
     * Peek up to {@code count} messages from the worker.dlq queue via the
     * RabbitMQ Management HTTP API without consuming (removing) them.
     */
    List<DlqMessageResponse> peekDlqMessages(int count, String orgSlug);

    /** Returns the current message count in the DLQ queue. */
    long getDlqMessageCount(String orgSlug);

    /** Consumes DLQ, finds message by eventId, republishes original event to main topic exchange, and ACKs it. */
    boolean reprocessMessage(String eventId, String orgSlug);

    /** Consumes DLQ, finds message by eventId, and ACKs (dismisses) it. */
    boolean dismissMessage(String eventId, String orgSlug);

    /** Consumes all DLQ messages, republishing original events to main topic exchange. */
    void reprocessAll(String orgSlug);

    /** Purges/Dismisses all messages in the DLQ queue. */
    void dismissAll(String orgSlug);
}

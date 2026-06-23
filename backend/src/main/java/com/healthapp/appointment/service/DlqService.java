package com.healthapp.appointment.service;

import com.healthapp.appointment.dto.response.DlqMessageResponse;
import java.util.List;

public interface DlqService {
    /**
     * Peek up to {@code count} messages from the worker.dlq queue via the
     * RabbitMQ Management HTTP API without consuming (removing) them.
     */
    List<DlqMessageResponse> peekDlqMessages(int count);

    /** Returns the current message count in the DLQ queue. */
    long getDlqMessageCount();
}

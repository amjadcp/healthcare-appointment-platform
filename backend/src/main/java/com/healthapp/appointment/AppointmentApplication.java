package com.healthapp.appointment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.nio.charset.StandardCharsets;

@SpringBootApplication
@EnableAsync
public class AppointmentApplication {
    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(AppointmentApplication.class, args);
    }

    private static void loadDotEnv() {
        File envFile = findDotEnv();
        if (envFile != null && envFile.exists()) {
            try (BufferedReader reader = new BufferedReader(new FileReader(envFile, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }
                    int eqIdx = line.indexOf('=');
                    if (eqIdx > 0) {
                        String key = line.substring(0, eqIdx).trim();
                        String value = line.substring(eqIdx + 1).trim();
                        // Strip quotes if present
                        if (value.startsWith("\"") && value.endsWith("\"")) {
                            value = value.substring(1, value.length() - 1);
                        } else if (value.startsWith("'") && value.endsWith("'")) {
                            value = value.substring(1, value.length() - 1);
                        }

                        // Local development convenience: map docker service names to 127.0.0.1
                        // if we are running outside of Docker (forces IPv4 to avoid Windows Docker Desktop IPv6 issues)
                        if (!new File("/.dockerenv").exists()) {
                            if ("DB_HOST".equals(key) || "RABBITMQ_HOST".equals(key)) {
                                if ("postgres".equals(value) || "rabbitmq".equals(value)) {
                                    value = "127.0.0.1";
                                }
                            }
                        }

                        // Only set if not already defined as System property or OS environment variable
                        if (System.getenv(key) == null && System.getProperty(key) == null) {
                            System.setProperty(key, value);
                        }
                    }
                }
            } catch (Exception e) {
                System.err.println("Failed to load .env file: " + e.getMessage());
            }
        }
    }

    private static File findDotEnv() {
        File dir = new File(".").getAbsoluteFile();
        while (dir != null) {
            File file = new File(dir, ".env");
            if (file.exists()) {
                return file;
            }
            dir = dir.getParentFile();
        }
        return null;
    }
}

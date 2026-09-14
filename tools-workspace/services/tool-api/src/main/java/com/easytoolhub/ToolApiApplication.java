package com.easytoolhub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * EasyToolHub multi-domain backend.
 * Domain modules live under {@code com.easytoolhub.<domain>} (e.g. pdf, future: text, media).
 * Redis autoconfig is excluded by default; enabled only when {@code app.job-store=redis}.
 */
@SpringBootApplication(exclude = {
    RedisAutoConfiguration.class,
    RedisRepositoriesAutoConfiguration.class
})
@ConfigurationPropertiesScan
@EnableScheduling
public class ToolApiApplication {
  public static void main(String[] args) {
    SpringApplication.run(ToolApiApplication.class, args);
  }
}

package com.easytoolhub.pdf.config;

import java.util.concurrent.Executor;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class PdfAsyncConfig {

  @Bean(name = "pdfBatchExecutor")
  public Executor pdfBatchExecutor(PdfProperties props) {
    int pool = Math.max(1, Math.min(8, props.batchMaxConcurrentJobs()));
    ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
    exec.setCorePoolSize(pool);
    exec.setMaxPoolSize(pool);
    // Bounded queue — reject rather than unbounded memory growth / CallerRuns deadlock with slots.
    exec.setQueueCapacity(Math.max(8, props.batchMaxConcurrentJobs() * 8));
    exec.setThreadNamePrefix("pdf-job-");
    exec.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
    exec.setWaitForTasksToCompleteOnShutdown(true);
    exec.setAwaitTerminationSeconds(30);
    exec.initialize();
    return exec;
  }

  @Bean(name = "pdfBatchSlot")
  public Semaphore pdfBatchSlot(PdfProperties props) {
    return new Semaphore(Math.max(1, props.batchMaxConcurrentJobs()));
  }
}

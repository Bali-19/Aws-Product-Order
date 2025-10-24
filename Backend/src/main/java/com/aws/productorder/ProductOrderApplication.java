package com.aws.productorder;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ProductOrderApplication {
    public static void main(String[] args) {
        SpringApplication.run(ProductOrderApplication.class, args);
    }
}

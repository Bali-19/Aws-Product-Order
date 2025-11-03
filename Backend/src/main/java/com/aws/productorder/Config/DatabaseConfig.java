package com.aws.productorder.Config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.json.JSONObject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@Configuration
public class DatabaseConfig {

    @Bean
    public DataSource dataSource() {
        String secretArn = System.getenv("DB_SECRET_ARN");
        String host = System.getenv("DB_HOST");
        String port = System.getenv("DB_PORT");
        String dbName = System.getenv("DB_NAME");

        if (secretArn == null) {
            throw new RuntimeException("DB_SECRET_ARN is not set");
        }

        SecretsManagerClient client = SecretsManagerClient.builder()
                .region(Region.US_EAST_1)
                .build();

        GetSecretValueResponse secretResponse = client.getSecretValue(
                GetSecretValueRequest.builder()
                        .secretId(secretArn)
                        .build()
        );

        JSONObject secretJson = new JSONObject(secretResponse.secretString());
        String username = secretJson.getString("username");
        String password = secretJson.getString("password");

        String jdbcUrl = "jdbc:mysql://" + host + ":" + port + "/" + dbName
                + "?allowPublicKeyRetrieval=true&useSSL=false";

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName("com.mysql.cj.jdbc.Driver");

        config.setMaximumPoolSize(5);
        config.setMinimumIdle(1);

        return new HikariDataSource(config);
    }
}

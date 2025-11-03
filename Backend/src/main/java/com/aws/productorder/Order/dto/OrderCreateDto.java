package com.aws.productorder.Order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrderCreateDto {
    private String customerName;
    private Long quantity;
    private Long productId;
}

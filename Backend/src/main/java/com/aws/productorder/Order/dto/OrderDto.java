package com.aws.productorder.Order.dto;

import com.aws.productorder.Product.dto.ProductDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class OrderDto {
    private Long id;
    private String customerName;
    private Long quantity;
    private LocalDateTime orderDate;
    private ProductDto product;

}

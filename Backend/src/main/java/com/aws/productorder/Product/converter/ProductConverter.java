package com.aws.productorder.Product.converter;

import com.aws.productorder.Product.dto.ProductDto;
import com.aws.productorder.Product.models.Product;
import org.springframework.stereotype.Component;

@Component
public class ProductConverter {
    public ProductDto toDto(Product product) {
        if (product == null) {
            return null;
        }

        return ProductDto.builder()
                .id(product.getId())
                .name(product.getName())
                .price(product.getPrice())
                .build();
    }
}
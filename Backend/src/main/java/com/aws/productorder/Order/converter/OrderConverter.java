package com.aws.productorder.Order.converter;

import com.aws.productorder.Order.dto.OrderDto;
import com.aws.productorder.Order.models.Orders;
import com.aws.productorder.Product.dto.ProductDto;
import com.aws.productorder.Product.models.Product;
import org.springframework.stereotype.Component;
@Component
public class OrderConverter {

    public OrderDto toDto(Orders order) {
        if (order == null) return null;

        Product product = order.getProduct();
        ProductDto productDto = null;
        if (product != null) {
            productDto = ProductDto.builder()
                    .id(product.getId())
                    .name(product.getName())
                    .price(product.getPrice())
                    .build();
        }

        return OrderDto.builder()
                .id(order.getId())
                .customerName(order.getCustomerName())
                .quantity(order.getQuantity())
                .orderDate(order.getOrderDate())
                .product(productDto)
                .build();
    }
}
package com.aws.productorder.Order.service;

import com.aws.productorder.Order.dto.OrderCreateDto;
import com.aws.productorder.Order.dto.OrderDto;
import com.aws.productorder.Order.models.Orders;
import com.aws.productorder.Order.repository.OrderRepository;
import com.aws.productorder.Product.dto.ProductDto;
import com.aws.productorder.Product.models.Product;
import com.aws.productorder.Product.repository.ProductRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class OrderServiceImpl implements OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ProductRepository productRepository;

    @Override
    public List<Orders> listAll() {
        return orderRepository.findAll();
    }

    @Override
    public Orders create(OrderCreateDto input) {
        Product product = productRepository.findById(input.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        Orders order = Orders.builder()
                .customerName(input.getCustomerName())
                .quantity(input.getQuantity())
                .orderDate(LocalDateTime.now())
                .product(product)
                .build();

        return orderRepository.save(order);
    }

    @Override
    public Orders findById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
    }
}

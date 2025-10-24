package com.aws.productorder.Order.controller;

import com.aws.productorder.Order.converter.OrderConverter;
import com.aws.productorder.Order.dto.OrderCreateDto;
import com.aws.productorder.Order.dto.OrderDto;
import com.aws.productorder.Order.models.Orders;
import com.aws.productorder.Order.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    @Autowired
    private OrderService orderService;
    @Autowired
    private OrderConverter orderConverter;

    @GetMapping
    public List<OrderDto> getAll() {
        List<Orders> orders = orderService.listAll();

        return orders.stream()
                .map(orderConverter::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    private OrderDto create(@RequestBody OrderCreateDto input) {
        Orders saved = orderService.create(input);
        return orderConverter.toDto(saved);
    }

    @GetMapping("/{id}")
    public OrderDto findById(@PathVariable Long id) {
        Orders order = orderService.findById(id);
        return orderConverter.toDto(order);
    }
}

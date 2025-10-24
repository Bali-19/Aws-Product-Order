package com.aws.productorder.Order.service;

import com.aws.productorder.Order.dto.OrderCreateDto;
import com.aws.productorder.Order.models.Orders;

import java.util.List;

public interface OrderService {

    public List<Orders> listAll();
    public Orders create(OrderCreateDto orderCreateDto);
    public Orders findById(Long id);
}

package com.aws.productorder.Order.repository;

import com.aws.productorder.Order.models.Orders;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Orders, Long> {
}

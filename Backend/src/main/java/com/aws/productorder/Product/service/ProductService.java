package com.aws.productorder.Product.service;

import com.aws.productorder.Product.dto.ProductCreateDto;
import com.aws.productorder.Product.models.Product;

import java.util.List;

public interface ProductService {
    List<Product> listAll();
    Product create(ProductCreateDto input);
    Product findById(Long id);
    void delete(Long id);
}

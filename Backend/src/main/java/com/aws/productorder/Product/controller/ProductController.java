package com.aws.productorder.Product.controller;

import com.aws.productorder.Product.converter.ProductConverter;
import com.aws.productorder.Product.dto.ProductCreateDto;
import com.aws.productorder.Product.dto.ProductDto;
import com.aws.productorder.Product.models.Product;
import com.aws.productorder.Product.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/product")
@RequiredArgsConstructor
public class ProductController {

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductConverter productConverter;

    @GetMapping
    public List<ProductDto> getAll() {
        return productService.listAll()
                .stream()
                .map(productConverter::toDto)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ProductDto getById(@PathVariable("id") Long id) {
        Product product = productService.findById(id);
        return productConverter.toDto(product);
    }

    @PostMapping
    public ProductDto create(@RequestBody ProductCreateDto input) {
        Product saved = productService.create(input);
        return productConverter.toDto(saved);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        productService.delete(id);
    }
}

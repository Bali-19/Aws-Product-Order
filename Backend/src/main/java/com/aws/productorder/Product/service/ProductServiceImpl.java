package com.aws.productorder.Product.service;

import com.aws.productorder.Product.dto.ProductCreateDto;
import com.aws.productorder.Product.models.Product;
import com.aws.productorder.Product.repository.ProductRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Transactional
public class ProductServiceImpl implements ProductService {

    @Autowired
    private ProductRepository productRepository;


    /**
     * @return
     */
    @Override
    public List<Product> listAll() {
        return productRepository.findAll();
    }

    /**
     * @param input
     * @return
     */
    @Override
    public Product create(ProductCreateDto input) {
        Product product = Product.builder()
                .name(input.getName())
                .price(input.getPrice())
                .build();
        return productRepository.save(product);
    }

    @Override
    public Product findById(Long id) {
        return productRepository.findById(id).orElseThrow(() -> new RuntimeException("Product not found"));
    }

    @Override
    public void delete(Long id) {
        if(!productRepository.existsById(id)) {
            throw new RuntimeException("Product not found");
        }
        productRepository.deleteById(id);
    }
}

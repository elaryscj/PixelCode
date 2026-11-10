package com.example.game_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class GameBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(GameBackendApplication.class, args);
	}

}

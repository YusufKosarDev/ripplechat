package com.ripplechat.backend.auth.oauth2;

import com.ripplechat.backend.user.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;

public class UserPrincipal implements OAuth2User {
    private String username;
    private Map<String, Object> attributes;

    public UserPrincipal(String username, Map<String, Object> attributes) {
        this.username = username;
        this.attributes = attributes;
    }

    public static UserPrincipal create(User user, Map<String, Object> attributes) {
        return new UserPrincipal(user.getUsername(), attributes);
    }

    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.emptyList();
    }

    @Override
    public String getName() {
        return username;
    }
}

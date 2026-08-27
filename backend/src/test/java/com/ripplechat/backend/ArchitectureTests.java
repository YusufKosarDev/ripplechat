package com.ripplechat.backend;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.repository.Repository;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;

/**
 * Enforces the modular-monolith conventions so the structure can't quietly rot:
 * consistent naming, one-directional layer dependencies, an independent shared
 * {@code common} package, and constructor (not field) injection.
 */
@AnalyzeClasses(packages = "com.ripplechat.backend", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTests {

    @ArchTest
    static final ArchRule controllers_are_named_Controller =
            classes().that().areAnnotatedWith(RestController.class)
                    .should().haveSimpleNameEndingWith("Controller");

    @ArchTest
    static final ArchRule services_are_named_Service =
            classes().that().areAnnotatedWith(Service.class)
                    .should().haveSimpleNameEndingWith("Service");

    @ArchTest
    static final ArchRule repositories_are_named_Repository =
            classes().that().areAssignableTo(Repository.class).and().areInterfaces()
                    .should().haveSimpleNameEndingWith("Repository");

    @ArchTest
    static final ArchRule services_do_not_depend_on_controllers =
            noClasses().that().haveSimpleNameEndingWith("Service")
                    .should().dependOnClassesThat().haveSimpleNameEndingWith("Controller");

    @ArchTest
    static final ArchRule repositories_do_not_depend_on_services_or_controllers =
            noClasses().that().haveSimpleNameEndingWith("Repository")
                    .should().dependOnClassesThat().haveSimpleNameEndingWith("Service")
                    .orShould().dependOnClassesThat().haveSimpleNameEndingWith("Controller");

    @ArchTest
    static final ArchRule common_does_not_depend_on_feature_packages =
            noClasses().that().resideInAPackage("..common..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "..auth..", "..channel..", "..message..", "..user..", "..poll..",
                            "..reaction..", "..search..", "..presence..", "..typing..", "..read..",
                            "..push..", "..link..", "..media..", "..gif..", "..websocket..", "..demo..",
                            "..redis..", "..call..");

    /**
     * Covers {@code @Value} as well as {@code @Autowired}. The rule used to name
     * only the latter, which is how {@code AuthController} came to inject its
     * Google client-id into a field while every other class took its
     * configuration through the constructor.
     */
    @ArchTest
    static final ArchRule fields_are_not_injected =
            noFields().should().beAnnotatedWith(Autowired.class)
                    .orShould().beAnnotatedWith(Value.class)
                    .because("prefer constructor injection");
}

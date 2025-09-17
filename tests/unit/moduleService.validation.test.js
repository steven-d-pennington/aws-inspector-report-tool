/**
 * Unit tests for ModuleService validation methods
 *
 * Tests comprehensive module validation functionality including:
 * - validateModuleToggle() with business rule enforcement
 * - validateModuleConfig() with schema validation
 * - getModuleConstraints() for system state information
 * - Error handling and detailed messaging
 */

const { expect } = require('chai');
const sinon = require('sinon');
const ModuleService = require('../../src/services/moduleService');
const ModuleSettings = require('../../src/models/moduleSettings');

describe('ModuleService Validation Methods', function() {
    let moduleService;
    let moduleSettingsStub;

    beforeEach(function() {
        moduleService = new ModuleService();

        // Stub the ModuleSettings methods
        moduleSettingsStub = sinon.createStubInstance(ModuleSettings);
        moduleService.moduleSettings = moduleSettingsStub;

        // Initialize the service manually for testing
        moduleService.isInitialized = true;

        // Set up default module registry entries
        moduleService.moduleRegistry.set('aws-inspector', {
            dependencies: [],
            conflicts: [],
            configSchema: {
                type: 'object',
                properties: {
                    autoRefresh: { type: 'boolean', default: true },
                    refreshInterval: { type: 'number', minimum: 30, default: 300 }
                }
            }
        });

        moduleService.moduleRegistry.set('sbom', {
            dependencies: [],
            conflicts: [],
            configSchema: {
                type: 'object',
                properties: {
                    format: { type: 'string', enum: ['json', 'xml', 'csv'], default: 'json' },
                    includeDevDependencies: { type: 'boolean', default: false }
                }
            }
        });

        moduleService.moduleRegistry.set('test-dependent', {
            dependencies: ['aws-inspector'],
            conflicts: [],
            configSchema: null
        });
    });

    afterEach(function() {
        sinon.restore();
    });

    describe('validateModuleToggle()', function() {

        describe('Input Validation', function() {
            it('should reject invalid module ID', async function() {
                const result = await moduleService.validateModuleToggle('', true);

                expect(result.valid).to.be.false;
                expect(result.error).to.be.true;
                expect(result.reason).to.include('Module ID must be a non-empty string');
            });

            it('should reject invalid enabled parameter', async function() {
                const result = await moduleService.validateModuleToggle('aws-inspector', 'true');

                expect(result.valid).to.be.false;
                expect(result.error).to.be.true;
                expect(result.reason).to.include('enabled must be a boolean value');
            });

            it('should reject non-existent module', async function() {
                moduleSettingsStub.getModule.withArgs('non-existent').resolves(null);

                const result = await moduleService.validateModuleToggle('non-existent', true);

                expect(result.valid).to.be.false;
                expect(result.reason).to.include('Module \'non-existent\' not found');
                expect(result.reason).to.include('Available modules can be retrieved via getModules()');
            });
        });

        describe('Business Rule: Default Module Protection', function() {
            it('should prevent disabling default modules', async function() {
                const defaultModule = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(defaultModule);

                const result = await moduleService.validateModuleToggle('aws-inspector', false);

                expect(result.valid).to.be.false;
                expect(result.constraints.isDefault).to.be.true;
                expect(result.reason).to.include('Cannot disable default module');
                expect(result.reason).to.include('Default modules (is_default=1) are protected');
                expect(result.reason).to.include('Consider configuring the module instead');
            });

            it('should allow enabling default modules', async function() {
                const defaultModule = {
                    module_id: 'aws-inspector',
                    enabled: false,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(defaultModule);
                moduleSettingsStub.getEnabledModules.resolves([{ module_id: 'sbom', enabled: true }]);

                const result = await moduleService.validateModuleToggle('aws-inspector', true);

                expect(result.valid).to.be.true;
                expect(result.operationType).to.equal('enable');
            });
        });

        describe('Business Rule: Minimum Enabled Modules', function() {
            it('should prevent disabling the last enabled module', async function() {
                const lastModule = {
                    module_id: 'sbom',
                    enabled: true,
                    is_default: false,
                    name: 'SBOM Reports'
                };

                moduleSettingsStub.getModule.withArgs('sbom').resolves(lastModule);
                moduleSettingsStub.getEnabledModules.resolves([lastModule]);

                const result = await moduleService.validateModuleToggle('sbom', false);

                expect(result.valid).to.be.false;
                expect(result.constraints.isLastEnabledModule).to.be.true;
                expect(result.reason).to.include('would leave no enabled modules');
                expect(result.reason).to.include('At least one module must remain active');
                expect(result.reason).to.include('Enable another module before disabling this one');
            });

            it('should allow disabling when multiple modules enabled', async function() {
                const moduleToDisable = {
                    module_id: 'sbom',
                    enabled: true,
                    is_default: false,
                    name: 'SBOM Reports'
                };

                const otherModule = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('sbom').resolves(moduleToDisable);
                moduleSettingsStub.getEnabledModules.resolves([moduleToDisable, otherModule]);

                const result = await moduleService.validateModuleToggle('sbom', false);

                expect(result.valid).to.be.true;
                expect(result.operationType).to.equal('disable');
            });
        });

        describe('Module Dependencies', function() {
            it('should prevent enabling module with disabled dependencies', async function() {
                const dependentModule = {
                    module_id: 'test-dependent',
                    enabled: false,
                    is_default: false,
                    name: 'Test Dependent Module'
                };

                const dependency = {
                    module_id: 'aws-inspector',
                    enabled: false,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('test-dependent').resolves(dependentModule);
                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(dependency);

                const result = await moduleService.validateModuleToggle('test-dependent', true);

                expect(result.valid).to.be.false;
                expect(result.reason).to.include('required dependency \'aws-inspector\' is not enabled');
                expect(result.reason).to.include('Enable the dependency first');
            });

            it('should prevent disabling module with enabled dependents', async function() {
                const dependency = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                const dependent = {
                    module_id: 'test-dependent',
                    enabled: true,
                    is_default: false,
                    name: 'Test Dependent Module'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(dependency);
                moduleSettingsStub.getModule.withArgs('test-dependent').resolves(dependent);
                moduleSettingsStub.getEnabledModules.resolves([dependency, dependent]);

                const result = await moduleService.validateModuleToggle('aws-inspector', false);

                expect(result.valid).to.be.false;
                expect(result.constraints.hasActiveDependents).to.be.true;
                expect(result.reason).to.include('following enabled modules depend on it');
                expect(result.reason).to.include('test-dependent');
                expect(result.reason).to.include('Disable the dependent modules first');
            });
        });

        describe('No-Operation Detection', function() {
            it('should detect when module is already in requested state', async function() {
                const enabledModule = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(enabledModule);

                const result = await moduleService.validateModuleToggle('aws-inspector', true);

                expect(result.valid).to.be.false;
                expect(result.currentState).to.be.true;
                expect(result.requestedState).to.be.true;
                expect(result.reason).to.include('Module \'aws-inspector\' is already enabled');
            });
        });

        describe('Warnings Generation', function() {
            it('should generate warnings for modules with dependencies', async function() {
                const dependentModule = {
                    module_id: 'test-dependent',
                    enabled: false,
                    is_default: false,
                    name: 'Test Dependent Module'
                };

                const dependency = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('test-dependent').resolves(dependentModule);
                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(dependency);

                const result = await moduleService.validateModuleToggle('test-dependent', true);

                expect(result.valid).to.be.true;
                expect(result.warnings).to.have.length.greaterThan(0);
                expect(result.warnings[0]).to.include('This module depends on: aws-inspector');
            });

            it('should generate warnings when disabling modules with dependents', async function() {
                const moduleWithDependents = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: false, // Override for test
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(moduleWithDependents);
                moduleSettingsStub.getEnabledModules.resolves([
                    moduleWithDependents,
                    { module_id: 'sbom', enabled: true }
                ]);

                const result = await moduleService.validateModuleToggle('aws-inspector', false);

                expect(result.valid).to.be.true;
                expect(result.warnings).to.have.length.greaterThan(0);
                expect(result.warnings[0]).to.include('Other modules may depend on this module');
            });
        });
    });

    describe('validateModuleConfig()', function() {

        describe('Input Validation', function() {
            it('should reject invalid module ID', async function() {
                const result = await moduleService.validateModuleConfig('', {});

                expect(result.valid).to.be.false;
                expect(result.errors).to.have.length.greaterThan(0);
                expect(result.errors[0].message).to.include('Module ID must be a non-empty string');
            });

            it('should reject non-existent module', async function() {
                moduleSettingsStub.getModule.withArgs('non-existent').resolves(null);

                const result = await moduleService.validateModuleConfig('non-existent', {});

                expect(result.valid).to.be.false;
                expect(result.error).to.include('Module \'non-existent\' not found');
            });
        });

        describe('Schema Validation', function() {
            it('should validate configuration against module schema', async function() {
                const module = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(module);

                const validConfig = {
                    autoRefresh: true,
                    refreshInterval: 300
                };

                const result = await moduleService.validateModuleConfig('aws-inspector', validConfig);

                expect(result.valid).to.be.true;
                expect(result.validatedConfig).to.deep.equal(validConfig);
                expect(result.schema).to.not.be.null;
            });

            it('should reject invalid configuration types', async function() {
                const module = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(module);

                const invalidConfig = {
                    autoRefresh: 'true', // Should be boolean
                    refreshInterval: '300' // Should be number
                };

                const result = await moduleService.validateModuleConfig('aws-inspector', invalidConfig);

                expect(result.valid).to.be.false;
                expect(result.errors).to.have.length.greaterThan(0);
                expect(result.errors[0].type).to.equal('schema_validation');
            });

            it('should enforce enum constraints', async function() {
                const module = {
                    module_id: 'sbom',
                    enabled: true,
                    is_default: false,
                    name: 'SBOM Reports'
                };

                moduleSettingsStub.getModule.withArgs('sbom').resolves(module);

                const invalidConfig = {
                    format: 'yaml' // Not in enum [json, xml, csv]
                };

                const result = await moduleService.validateModuleConfig('sbom', invalidConfig);

                expect(result.valid).to.be.false;
                expect(result.errors[0].message).to.include('must be one of: json, xml, csv');
            });

            it('should apply default values for missing properties', async function() {
                const module = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(module);

                const partialConfig = {
                    autoRefresh: false
                    // refreshInterval missing - should get default
                };

                const result = await moduleService.validateModuleConfig('aws-inspector', partialConfig);

                expect(result.valid).to.be.true;
                expect(result.validatedConfig.refreshInterval).to.equal(300); // Default value
            });
        });

        describe('Module Without Schema', function() {
            it('should handle modules without configuration schema', async function() {
                const module = {
                    module_id: 'test-dependent',
                    enabled: true,
                    is_default: false,
                    name: 'Test Dependent Module'
                };

                moduleSettingsStub.getModule.withArgs('test-dependent').resolves(module);

                const config = { anyProperty: 'anyValue' };

                const result = await moduleService.validateModuleConfig('test-dependent', config);

                expect(result.valid).to.be.true;
                expect(result.warnings).to.include('No configuration schema defined for module \'test-dependent\'');
                expect(result.validatedConfig).to.deep.equal(config);
            });
        });

        describe('Configuration Warnings and Suggestions', function() {
            it('should generate warnings for problematic AWS Inspector config', async function() {
                const module = {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                };

                moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(module);

                const problemConfig = {
                    autoRefresh: true,
                    refreshInterval: 10 // Too low
                };

                const result = await moduleService.validateModuleConfig('aws-inspector', problemConfig);

                expect(result.valid).to.be.true;
                expect(result.warnings).to.include('Refresh interval below 60 seconds may cause high API usage');
            });

            it('should generate suggestions for incomplete config', async function() {
                const module = {
                    module_id: 'sbom',
                    enabled: true,
                    is_default: false,
                    name: 'SBOM Reports'
                };

                moduleSettingsStub.getModule.withArgs('sbom').resolves(module);

                const incompleteConfig = {
                    includeDevDependencies: false
                    // format missing
                };

                const result = await moduleService.validateModuleConfig('sbom', incompleteConfig);

                expect(result.valid).to.be.true;
                expect(result.suggestions).to.include('Specify a preferred format (json, xml, csv)');
            });

            it('should warn about disabled module configuration', async function() {
                const module = {
                    module_id: 'sbom',
                    enabled: false, // Disabled
                    is_default: false,
                    name: 'SBOM Reports'
                };

                moduleSettingsStub.getModule.withArgs('sbom').resolves(module);

                const config = { format: 'json' };

                const result = await moduleService.validateModuleConfig('sbom', config);

                expect(result.valid).to.be.true;
                expect(result.warnings).to.include('Module \'sbom\' is currently disabled');
                expect(result.warnings).to.include('Configuration changes will take effect when the module is enabled');
            });
        });
    });

    describe('getModuleConstraints()', function() {

        beforeEach(function() {
            const allModules = [
                {
                    module_id: 'aws-inspector',
                    enabled: true,
                    is_default: true,
                    name: 'AWS Inspector'
                },
                {
                    module_id: 'sbom',
                    enabled: false,
                    is_default: false,
                    name: 'SBOM Reports'
                },
                {
                    module_id: 'test-dependent',
                    enabled: false,
                    is_default: false,
                    name: 'Test Dependent Module'
                }
            ];

            moduleSettingsStub.getAllModules.resolves(allModules);
        });

        it('should return comprehensive system constraints', async function() {
            const constraints = await moduleService.getModuleConstraints();

            expect(constraints).to.have.property('timestamp');
            expect(constraints).to.have.property('system');
            expect(constraints).to.have.property('rules');
            expect(constraints).to.have.property('current');
            expect(constraints).to.have.property('modules');

            expect(constraints.system.totalModules).to.equal(3);
            expect(constraints.system.enabledModules).to.equal(1);
            expect(constraints.system.disabledModules).to.equal(2);
            expect(constraints.system.defaultModules).to.equal(1);
        });

        it('should identify business rules correctly', async function() {
            const constraints = await moduleService.getModuleConstraints();

            expect(constraints.rules.minEnabledModules).to.equal(1);
            expect(constraints.rules.defaultModulesProtected).to.be.true;
            expect(constraints.rules.moduleIdFormat).to.equal('^[a-z0-9-_]+$');
        });

        it('should calculate current system state', async function() {
            const constraints = await moduleService.getModuleConstraints();

            expect(constraints.current.canDisableAnyModule).to.be.false; // Only one enabled
            expect(constraints.current.protectedModules).to.deep.equal(['aws-inspector']);
            expect(constraints.current.vulnerableToDisabling).to.equal('aws-inspector');
        });

        it('should provide per-module constraint information', async function() {
            const constraints = await moduleService.getModuleConstraints();

            const awsInspector = constraints.modules['aws-inspector'];
            expect(awsInspector.enabled).to.be.true;
            expect(awsInspector.isDefault).to.be.true;
            expect(awsInspector.canEnable).to.be.false; // Already enabled
            expect(awsInspector.canDisable).to.be.false; // Protected by multiple rules
            expect(awsInspector.hasSchema).to.be.true;
            expect(awsInspector.constraints.protectedByDefault).to.be.true;
            expect(awsInspector.constraints.protectedByMinimum).to.be.true;

            const sbom = constraints.modules['sbom'];
            expect(sbom.enabled).to.be.false;
            expect(sbom.isDefault).to.be.false;
            expect(sbom.canEnable).to.be.true;
            expect(sbom.canDisable).to.be.false; // Already disabled
            expect(sbom.hasSchema).to.be.true;

            const testDependent = constraints.modules['test-dependent'];
            expect(testDependent.dependencies).to.deep.equal(['aws-inspector']);
            expect(testDependent.constraints.hasUnmetDependencies).to.be.false; // Dependency is enabled
        });

        it('should detect unmet dependencies', async function() {
            // Modify the stub to show aws-inspector as disabled
            const allModules = [
                {
                    module_id: 'aws-inspector',
                    enabled: false, // Disabled
                    is_default: true,
                    name: 'AWS Inspector'
                },
                {
                    module_id: 'sbom',
                    enabled: true,
                    is_default: false,
                    name: 'SBOM Reports'
                },
                {
                    module_id: 'test-dependent',
                    enabled: false,
                    is_default: false,
                    name: 'Test Dependent Module'
                }
            ];

            moduleSettingsStub.getAllModules.resolves(allModules);

            const constraints = await moduleService.getModuleConstraints();

            const testDependent = constraints.modules['test-dependent'];
            expect(testDependent.constraints.hasUnmetDependencies).to.be.true;
            expect(testDependent.unmetDependencies).to.deep.equal(['aws-inspector']);
        });
    });

    describe('Integration with toggleModule()', function() {

        it('should integrate validation into toggleModule flow', async function() {
            const module = {
                module_id: 'aws-inspector',
                enabled: true,
                is_default: true,
                name: 'AWS Inspector'
            };

            moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(module);
            moduleSettingsStub.getEnabledModules.resolves([module]);

            try {
                await moduleService.toggleModule('aws-inspector', false);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Cannot disable default module');
                expect(error.message).to.include('Default modules (is_default=1) are protected');
            }
        });
    });

    describe('Integration with updateModuleConfig()', function() {

        it('should integrate validation into updateModuleConfig flow', async function() {
            const module = {
                module_id: 'aws-inspector',
                enabled: true,
                is_default: true,
                name: 'AWS Inspector'
            };

            moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(module);
            moduleSettingsStub.updateModuleConfig.resolves();

            const invalidConfig = {
                autoRefresh: 'true' // Should be boolean
            };

            try {
                await moduleService.updateModuleConfig('aws-inspector', invalidConfig);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('autoRefresh\' must be a boolean');
            }
        });
    });

    describe('Error Handling and Resilience', function() {

        it('should handle database errors gracefully in validation', async function() {
            moduleSettingsStub.getModule.rejects(new Error('Database connection failed'));

            const result = await moduleService.validateModuleToggle('aws-inspector', true);

            expect(result.valid).to.be.false;
            expect(result.error).to.be.true;
            expect(result.reason).to.include('Database connection failed');
        });

        it('should handle malformed configuration gracefully', async function() {
            const module = {
                module_id: 'aws-inspector',
                enabled: true,
                is_default: true,
                name: 'AWS Inspector'
            };

            moduleSettingsStub.getModule.withArgs('aws-inspector').resolves(module);

            // Pass circular reference that can't be JSON stringified
            const circularConfig = {};
            circularConfig.self = circularConfig;

            const result = await moduleService.validateModuleConfig('aws-inspector', circularConfig);

            expect(result.valid).to.be.false;
            expect(result.errors).to.have.length.greaterThan(0);
        });
    });
});

/**
 * Example usage and integration tests demonstrating the validation API
 */
describe('ModuleService Validation - Usage Examples', function() {
    let moduleService;

    before(async function() {
        // This would be a real ModuleService instance in integration tests
        // For now, we'll document the expected usage patterns
    });

    describe('Example: Validating module toggle before UI action', function() {
        it('should demonstrate validation workflow', function() {
            // Example client code using the validation API:

            const exampleValidationWorkflow = async (moduleId, enabled) => {
                try {
                    // 1. Validate the operation before attempting
                    const validation = await moduleService.validateModuleToggle(moduleId, enabled);

                    if (!validation.valid) {
                        // Show user-friendly error message
                        return {
                            success: false,
                            message: validation.reason,
                            canRetry: !validation.constraints?.isDefault,
                            suggestions: validation.warnings || []
                        };
                    }

                    // 2. Show warnings to user if any
                    if (validation.warnings?.length > 0) {
                        const confirmMessage = `This operation will proceed with the following warnings:\n${validation.warnings.join('\n')}\n\nContinue?`;
                        // In real app: const confirmed = await showConfirmDialog(confirmMessage);
                        // if (!confirmed) return { success: false, message: 'Operation cancelled by user' };
                    }

                    // 3. Perform the actual operation
                    const result = await moduleService.toggleModule(moduleId, enabled);

                    return {
                        success: true,
                        module: result,
                        warnings: result.validation?.warnings || []
                    };

                } catch (error) {
                    return {
                        success: false,
                        message: error.message,
                        canRetry: false
                    };
                }
            };

            // This demonstrates the API design
            expect(exampleValidationWorkflow).to.be.a('function');
        });
    });

    describe('Example: Configuration validation before saving', function() {
        it('should demonstrate configuration validation workflow', function() {
            const exampleConfigValidation = async (moduleId, config) => {
                try {
                    // 1. Validate configuration before saving
                    const validation = await moduleService.validateModuleConfig(moduleId, config);

                    if (!validation.valid) {
                        return {
                            success: false,
                            errors: validation.errors,
                            suggestions: validation.suggestions
                        };
                    }

                    // 2. Show warnings and suggestions to user
                    const feedback = {
                        warnings: validation.warnings || [],
                        suggestions: validation.suggestions || []
                    };

                    // 3. Use validated config (with defaults applied)
                    const result = await moduleService.updateModuleConfig(moduleId, validation.validatedConfig);

                    return {
                        success: true,
                        module: result,
                        feedback
                    };

                } catch (error) {
                    return {
                        success: false,
                        message: error.message
                    };
                }
            };

            expect(exampleConfigValidation).to.be.a('function');
        });
    });

    describe('Example: System constraints for UI state management', function() {
        it('should demonstrate constraints usage', function() {
            const exampleConstraintsUsage = async () => {
                try {
                    // Get current system constraints
                    const constraints = await moduleService.getModuleConstraints();

                    // Use constraints to control UI state
                    const uiState = {
                        canAddMoreModules: constraints.system.totalModules < 10,
                        hasVulnerableModule: !!constraints.current.vulnerableToDisabling,
                        moduleControls: {}
                    };

                    // Generate UI controls based on constraints
                    for (const [moduleId, moduleConstraints] of Object.entries(constraints.modules)) {
                        uiState.moduleControls[moduleId] = {
                            enableButton: {
                                visible: !moduleConstraints.enabled,
                                enabled: moduleConstraints.canEnable,
                                tooltip: moduleConstraints.canEnable ? 'Enable module' : 'Cannot enable: check dependencies'
                            },
                            disableButton: {
                                visible: moduleConstraints.enabled,
                                enabled: moduleConstraints.canDisable,
                                tooltip: moduleConstraints.canDisable ? 'Disable module' :
                                    moduleConstraints.constraints.protectedByDefault ? 'Default modules cannot be disabled' :
                                    moduleConstraints.constraints.protectedByMinimum ? 'At least one module must remain enabled' :
                                    moduleConstraints.constraints.protectedByDependents ? 'Other modules depend on this one' :
                                    'Cannot disable module'
                            },
                            configButton: {
                                visible: true,
                                enabled: moduleConstraints.canConfigure,
                                hasSchema: moduleConstraints.hasSchema
                            }
                        };
                    }

                    return uiState;

                } catch (error) {
                    console.error('Failed to get constraints:', error);
                    return { error: error.message };
                }
            };

            expect(exampleConstraintsUsage).to.be.a('function');
        });
    });
});
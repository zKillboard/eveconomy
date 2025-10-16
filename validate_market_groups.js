#!/usr/bin/env node
'use strict';

/**
 * Market Groups Validator
 * Validates the structure and content of docs/api/groups.json
 */

const fs = require('fs').promises;
const path = require('path');

class MarketGroupsValidator {
    constructor(filePath) {
        this.filePath = filePath || path.join(__dirname, 'docs', 'api', 'groups.json');
        this.stats = {
            totalGroups: 0,
            totalSubgroups: 0,
            totalItems: 0,
            maxDepth: 0,
            emptyGroups: 0,
            duplicateItems: new Set()
        };
        this.allItems = new Map(); // item_id -> name mappings for duplicate detection
    }

    /**
     * Load and parse the groups JSON file
     */
    async loadGroupsFile() {
        try {
            const content = await fs.readFile(this.filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to load groups file: ${error.message}`);
        }
    }

    /**
     * Validate the structure of a group node
     */
    validateGroupNode(node, groupName, depth = 0) {
        const issues = [];

        // Update max depth
        this.stats.maxDepth = Math.max(this.stats.maxDepth, depth);

        // Check required properties
        if (typeof node !== 'object' || node === null) {
            issues.push(`Group "${groupName}" is not an object`);
            return issues;
        }

        const requiredProps = ['id', 'name', 'subgroups', 'items'];
        for (const prop of requiredProps) {
            if (!(prop in node)) {
                issues.push(`Group "${groupName}" missing required property: ${prop}`);
            }
        }

        // Validate id
        if (typeof node.id !== 'number' || node.id <= 0) {
            issues.push(`Group "${groupName}" has invalid id: ${node.id}`);
        }

        // Validate name
        if (typeof node.name !== 'string' || node.name.trim() === '') {
            issues.push(`Group "${groupName}" has invalid name: ${node.name}`);
        }

        // Validate subgroups
        if (typeof node.subgroups !== 'object' || node.subgroups === null) {
            issues.push(`Group "${groupName}" has invalid subgroups`);
        } else {
            this.stats.totalSubgroups += Object.keys(node.subgroups).length;
            
            // Recursively validate subgroups
            for (const [subgroupName, subgroup] of Object.entries(node.subgroups)) {
                issues.push(...this.validateGroupNode(subgroup, `${groupName} > ${subgroupName}`, depth + 1));
            }
        }

        // Validate items
        if (typeof node.items !== 'object' || node.items === null) {
            issues.push(`Group "${groupName}" has invalid items`);
        } else {
            const itemCount = Object.keys(node.items).length;
            this.stats.totalItems += itemCount;
            
            if (itemCount === 0 && Object.keys(node.subgroups).length === 0) {
                this.stats.emptyGroups++;
            }

            // Validate each item
            for (const [itemName, item] of Object.entries(node.items)) {
                const itemIssues = this.validateItem(item, itemName, groupName);
                issues.push(...itemIssues);
            }
        }

        return issues;
    }

    /**
     * Validate an individual item
     */
    validateItem(item, itemName, groupName) {
        const issues = [];

        // Check required properties
        if (typeof item !== 'object' || item === null) {
            issues.push(`Item "${itemName}" in group "${groupName}" is not an object`);
            return issues;
        }

        const requiredProps = ['item_id', 'name'];
        for (const prop of requiredProps) {
            if (!(prop in item)) {
                issues.push(`Item "${itemName}" in group "${groupName}" missing property: ${prop}`);
            }
        }

        // Validate item_id
        if (typeof item.item_id !== 'number' || item.item_id <= 0) {
            issues.push(`Item "${itemName}" in group "${groupName}" has invalid item_id: ${item.item_id}`);
        }

        // Validate name
        if (typeof item.name !== 'string' || item.name.trim() === '') {
            issues.push(`Item "${itemName}" in group "${groupName}" has invalid name: ${item.name}`);
        }

        // Check for name consistency
        if (item.name !== itemName) {
            issues.push(`Item name mismatch in group "${groupName}": key="${itemName}", name="${item.name}"`);
        }

        // Check for duplicate item IDs
        if (this.allItems.has(item.item_id)) {
            const existingName = this.allItems.get(item.item_id);
            if (existingName !== item.name) {
                this.stats.duplicateItems.add(item.item_id);
                issues.push(`Duplicate item_id ${item.item_id}: "${existingName}" and "${item.name}"`);
            }
        } else {
            this.allItems.set(item.item_id, item.name);
        }

        return issues;
    }

    /**
     * Generate a validation report
     */
    generateReport(issues) {
        const report = {
            isValid: issues.length === 0,
            issueCount: issues.length,
            issues: issues,
            statistics: {
                ...this.stats,
                duplicateItemsCount: this.stats.duplicateItems.size
            }
        };

        delete report.statistics.duplicateItems; // Remove the Set object
        return report;
    }

    /**
     * Print a formatted validation report
     */
    printReport(report) {
        console.log('📋 Market Groups Validation Report');
        console.log('================================');
        
        if (report.isValid) {
            console.log('✅ Validation PASSED - No issues found!');
        } else {
            console.log(`❌ Validation FAILED - ${report.issueCount} issues found:`);
            console.log('');
            
            report.issues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue}`);
            });
        }
        
        console.log('');
        console.log('📊 Statistics:');
        console.log(`   Total Groups: ${report.statistics.totalGroups}`);
        console.log(`   Total Subgroups: ${report.statistics.totalSubgroups}`);
        console.log(`   Total Items: ${report.statistics.totalItems}`);
        console.log(`   Maximum Depth: ${report.statistics.maxDepth}`);
        console.log(`   Empty Groups: ${report.statistics.emptyGroups}`);
        console.log(`   Duplicate Item IDs: ${report.statistics.duplicateItemsCount}`);
        
        const fileSizeKB = require('fs').statSync(this.filePath).size / 1024;
        console.log(`   File Size: ${fileSizeKB.toFixed(2)} KB`);
    }

    /**
     * Main validation function
     */
    async validate() {
        console.log(`🔍 Validating market groups file: ${this.filePath}`);
        console.log('');

        try {
            // Load the file
            const groups = await this.loadGroupsFile();
            
            if (typeof groups !== 'object' || groups === null) {
                throw new Error('Root element is not an object');
            }

            // Validate each top-level group
            const issues = [];
            this.stats.totalGroups = Object.keys(groups).length;

            for (const [groupName, group] of Object.entries(groups)) {
                const groupIssues = this.validateGroupNode(group, groupName);
                issues.push(...groupIssues);
            }

            // Generate and display report
            const report = this.generateReport(issues);
            this.printReport(report);

            return report.isValid;

        } catch (error) {
            console.error(`❌ Validation failed: ${error.message}`);
            return false;
        }
    }
}

// CLI execution
if (require.main === module) {
    const filePath = process.argv[2];
    const validator = new MarketGroupsValidator(filePath);
    
    validator.validate().then(isValid => {
        process.exit(isValid ? 0 : 1);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = MarketGroupsValidator;
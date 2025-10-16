#!/usr/bin/env node
'use strict';

/**
 * EVE Online Market Groups Updater - Enhanced Version
 * Updates docs/api/groups.json using ESI (EVE Swagger Interface) endpoints
 * 
 * Features:
 * - Hierarchical market group structure
 * - Rate limiting and error handling
 * - Incremental updates support
 * - Detailed logging
 * - Backup creation
 * - Statistics reporting
 */

const fs = require('fs').promises;
const https = require('https');
const path = require('path');

class EnhancedMarketGroupsUpdater {
    constructor(options = {}) {
        this.esiBaseUrl = options.esiBaseUrl || 'https://esi.evetech.net';
        this.userAgent = options.userAgent || 'EVEconomy Market Groups Updater v2.0';
        this.rateLimit = options.rateLimit || 150; // Conservative rate limit
        this.outputFile = options.outputFile || path.join(__dirname, 'docs', 'api', 'groups.json');
        this.backupFile = options.backupFile || path.join(__dirname, 'docs', 'api', 'groups.json.backup');
        this.cacheFile = options.cacheFile || path.join(__dirname, 'temp', 'market_groups_cache.json');
        
        // Internal state
        this.marketGroups = new Map();
        this.typeInfo = new Map();
        this.categoryInfo = new Map();
        this.groupInfo = new Map();
        this.rateLimitWindow = 1000;
        this.lastRequestTime = 0;
        this.requestCount = 0;
        this.stats = {
            groupsFetched: 0,
            typesFetched: 0,
            categoriesFetched: 0,
            groupDefinitionsFetched: 0,
            apiCalls: 0,
            startTime: null,
            endTime: null
        };
        
        // Options
        this.createBackup = options.createBackup !== false;
        this.useCache = options.useCache !== false;
        this.fetchCategories = options.fetchCategories !== false;
        this.verbose = options.verbose || false;
    }

    /**
     * Utility function for sleeping
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log with optional verbosity control
     */
    log(message, isVerbose = false) {
        if (!isVerbose || this.verbose) {
            console.log(message);
        }
    }

    /**
     * Rate limiting for ESI requests
     */
    async enforceRateLimit() {
        const now = Date.now();
        
        if (now - this.lastRequestTime >= this.rateLimitWindow) {
            this.requestCount = 0;
            this.lastRequestTime = now;
        }
        
        if (this.requestCount >= this.rateLimit) {
            const waitTime = this.rateLimitWindow - (now - this.lastRequestTime);
            if (waitTime > 0) {
                this.log(`Rate limiting: waiting ${waitTime}ms`, true);
                await this.sleep(waitTime);
                this.requestCount = 0;
                this.lastRequestTime = Date.now();
            }
        }
        
        this.requestCount++;
    }

    /**
     * Enhanced HTTP request with better error handling
     */
    async makeRequest(endpoint, retries = 3, timeout = 30000) {
        await this.enforceRateLimit();
        this.stats.apiCalls++;
        
        return new Promise((resolve, reject) => {
            const url = `${this.esiBaseUrl}${endpoint}`;
            this.log(`API Call: ${url}`, true);
            
            const options = {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                timeout: timeout
            };
            
            const req = https.get(url, options, (res) => {
                let data = '';
                
                // Handle different status codes appropriately
                if (res.statusCode === 404) {
                    this.log(`Not found: ${endpoint}`, true);
                    resolve(null);
                    return;
                }
                
                if (res.statusCode === 304) {
                    this.log(`Not modified: ${endpoint}`, true);
                    resolve({ notModified: true });
                    return;
                }
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            resolve(json);
                        } catch (error) {
                            reject(new Error(`JSON parse error for ${url}: ${error.message}`));
                        }
                    } else if (res.statusCode >= 500 && retries > 0) {
                        this.log(`Server error ${res.statusCode} for ${url}, retrying in 2s...`);
                        setTimeout(() => {
                            this.makeRequest(endpoint, retries - 1, timeout)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                    } else if (res.statusCode === 420 && retries > 0) {
                        // Rate limited by ESI
                        this.log('Rate limited by ESI, waiting 60s...', true);
                        setTimeout(() => {
                            this.makeRequest(endpoint, retries - 1, timeout)
                                .then(resolve)
                                .catch(reject);
                        }, 60000);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode} for ${url}: ${data.substring(0, 200)}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                if (retries > 0) {
                    this.log(`Request error for ${url}, retrying: ${error.message}`, true);
                    setTimeout(() => {
                        this.makeRequest(endpoint, retries - 1, timeout)
                            .then(resolve)
                            .catch(reject);
                    }, 1000);
                } else {
                    reject(new Error(`Request failed for ${url}: ${error.message}`));
                }
            });
            
            req.setTimeout(timeout, () => {
                req.destroy();
                reject(new Error(`Request timeout for ${url}`));
            });
        });
    }

    /**
     * Create backup of existing groups.json
     */
    async createBackupFile() {
        if (!this.createBackup) return;
        
        try {
            await fs.access(this.outputFile);
            await fs.copyFile(this.outputFile, this.backupFile);
            this.log(`Backup created: ${this.backupFile}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.log(`Warning: Could not create backup: ${error.message}`);
            }
        }
    }

    /**
     * Load cache file if it exists and is recent
     */
    async loadCache() {
        if (!this.useCache) return null;
        
        try {
            const cacheData = JSON.parse(await fs.readFile(this.cacheFile, 'utf8'));
            const cacheAge = Date.now() - cacheData.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (cacheAge < maxAge) {
                this.log(`Using cache from ${new Date(cacheData.timestamp).toISOString()}`);
                return cacheData;
            } else {
                this.log('Cache is too old, fetching fresh data');
            }
        } catch (error) {
            this.log('No valid cache found, fetching fresh data', true);
        }
        
        return null;
    }

    /**
     * Save data to cache
     */
    async saveCache(data) {
        if (!this.useCache) return;
        
        try {
            await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
            const cacheData = {
                timestamp: Date.now(),
                data: data
            };
            await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
            this.log('Cache updated', true);
        } catch (error) {
            this.log(`Warning: Could not save cache: ${error.message}`);
        }
    }

    /**
     * Fetch all market groups from ESI
     */
    async fetchMarketGroups() {
        this.log('Fetching market group IDs...');
        const groupIds = await this.makeRequest('/latest/markets/groups/');
        
        if (!Array.isArray(groupIds)) {
            throw new Error('Failed to fetch market group IDs');
        }
        
        this.log(`Found ${groupIds.length} market groups`);
        
        // Process in controlled batches
        const batchSize = 5; // Smaller batch size for better control
        for (let i = 0; i < groupIds.length; i += batchSize) {
            const batch = groupIds.slice(i, i + batchSize);
            
            // Process batch sequentially to better control rate limiting
            for (const groupId of batch) {
                try {
                    await this.fetchMarketGroupDetails(groupId);
                    this.stats.groupsFetched++;
                } catch (error) {
                    this.log(`Error fetching group ${groupId}: ${error.message}`);
                }
            }
            
            // Progress update
            if (i % (batchSize * 4) === 0 || i + batchSize >= groupIds.length) {
                this.log(`Progress: ${Math.min(i + batchSize, groupIds.length)}/${groupIds.length} market groups`);
            }
            
            // Small delay between batches
            await this.sleep(50);
        }
        
        this.log(`Fetched ${this.stats.groupsFetched} market groups successfully`);
    }

    /**
     * Fetch details for a specific market group
     */
    async fetchMarketGroupDetails(groupId) {
        const groupData = await this.makeRequest(`/latest/markets/groups/${groupId}/`);
        
        if (groupData && groupData.name) {
            this.marketGroups.set(groupId, {
                id: groupId,
                name: groupData.name,
                description: groupData.description || '',
                parent_group_id: groupData.parent_group_id,
                types: groupData.types || []
            });
        }
    }

    /**
     * Fetch type information for items
     */
    async fetchTypeInformation() {
        // Collect all unique type IDs
        const typeIds = new Set();
        this.marketGroups.forEach(group => {
            if (group.types) {
                group.types.forEach(typeId => typeIds.add(typeId));
            }
        });
        
        this.log(`Found ${typeIds.size} unique types to fetch`);
        
        const typeIdArray = Array.from(typeIds);
        const batchSize = 3; // Conservative batch size
        
        for (let i = 0; i < typeIdArray.length; i += batchSize) {
            const batch = typeIdArray.slice(i, i + batchSize);
            
            // Process types sequentially
            for (const typeId of batch) {
                try {
                    await this.fetchTypeDetails(typeId);
                    this.stats.typesFetched++;
                } catch (error) {
                    this.log(`Error fetching type ${typeId}: ${error.message}`);
                }
            }
            
            // Progress update
            if (i % (batchSize * 10) === 0 || i + batchSize >= typeIdArray.length) {
                this.log(`Progress: ${Math.min(i + batchSize, typeIdArray.length)}/${typeIdArray.length} types`);
            }
            
            await this.sleep(30);
        }
        
        this.log(`Fetched ${this.stats.typesFetched} types successfully`);
    }

    /**
     * Fetch details for a specific type
     */
    async fetchTypeDetails(typeId) {
        const typeData = await this.makeRequest(`/latest/universe/types/${typeId}/`);
        
        if (typeData && typeData.name) {
            this.typeInfo.set(typeId, {
                id: typeId,
                name: typeData.name,
                description: typeData.description || '',
                group_id: typeData.group_id,
                category_id: typeData.category_id,
                published: typeData.published !== false,
                market_group_id: typeData.market_group_id
            });
        }
    }

    /**
     * Build hierarchical market group structure
     */
    buildHierarchy() {
        this.log('Building market group hierarchy...');
        
        const hierarchy = {};
        
        // Find root groups (no parent)
        const rootGroups = Array.from(this.marketGroups.values())
            .filter(group => !group.parent_group_id)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Build hierarchy
        rootGroups.forEach(group => {
            hierarchy[group.name] = this.buildGroupNode(group);
        });
        
        this.log(`Built hierarchy with ${Object.keys(hierarchy).length} root categories`);
        return hierarchy;
    }

    /**
     * Build a group node recursively
     */
    buildGroupNode(group) {
        const node = {
            id: group.id,
            name: group.name,
            subgroups: {},
            items: {}
        };
        
        // Find and add child groups
        const childGroups = Array.from(this.marketGroups.values())
            .filter(childGroup => childGroup.parent_group_id === group.id)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        childGroups.forEach(childGroup => {
            node.subgroups[childGroup.name] = this.buildGroupNode(childGroup);
        });
        
        // Add items (types) to this group
        if (group.types && group.types.length > 0) {
            const validTypes = group.types
                .map(typeId => this.typeInfo.get(typeId))
                .filter(typeData => typeData && typeData.published && typeData.name)
                .sort((a, b) => a.name.localeCompare(b.name));
            
            validTypes.forEach(typeData => {
                node.items[typeData.name] = {
                    item_id: typeData.id,
                    name: typeData.name
                };
            });
        }
        
        return node;
    }

    /**
     * Generate statistics report
     */
    generateStats() {
        const duration = (this.stats.endTime - this.stats.startTime) / 1000;
        
        return {
            executionTime: `${duration.toFixed(2)} seconds`,
            apiCalls: this.stats.apiCalls,
            marketGroups: this.stats.groupsFetched,
            types: this.stats.typesFetched,
            avgApiCallsPerSecond: (this.stats.apiCalls / duration).toFixed(2),
            cacheUsed: this.useCache,
            backupCreated: this.createBackup
        };
    }

    /**
     * Save the market groups data to file
     */
    async saveToFile(data) {
        this.log(`Saving market groups to ${this.outputFile}...`);
        
        try {
            // Ensure output directory exists
            await fs.mkdir(path.dirname(this.outputFile), { recursive: true });
            
            // Create formatted JSON
            const jsonString = JSON.stringify(data, null, 2);
            await fs.writeFile(this.outputFile, jsonString, 'utf8');
            
            const sizeInMB = (Buffer.byteLength(jsonString) / 1024 / 1024).toFixed(2);
            this.log(`✅ Market groups saved successfully! File size: ${sizeInMB} MB`);
            
            // Save to cache
            await this.saveCache(data);
            
        } catch (error) {
            console.error('❌ Failed to save file:', error.message);
            throw error;
        }
    }

    /**
     * Main execution function
     */
    async run() {
        this.stats.startTime = Date.now();
        
        console.log('🚀 Starting Enhanced EVE Online Market Groups Update');
        console.log(`📡 ESI Base URL: ${this.esiBaseUrl}`);
        console.log(`⚡ Rate Limit: ${this.rateLimit} requests per second`);
        console.log(`📁 Output File: ${this.outputFile}`);
        console.log('');
        
        try {
            // Create backup
            await this.createBackupFile();
            
            // Try to load from cache first
            const cachedData = await this.loadCache();
            if (cachedData) {
                await this.saveToFile(cachedData.data);
                console.log('✅ Used cached data, update completed quickly!');
                return;
            }
            
            // Fetch fresh data
            await this.fetchMarketGroups();
            await this.fetchTypeInformation();
            
            // Build and save hierarchy
            const hierarchy = this.buildHierarchy();
            await this.saveToFile(hierarchy);
            
            this.stats.endTime = Date.now();
            
            // Display statistics
            const stats = this.generateStats();
            console.log('\n📊 Update Statistics:');
            console.log(`   Execution Time: ${stats.executionTime}`);
            console.log(`   API Calls Made: ${stats.apiCalls}`);
            console.log(`   Market Groups: ${stats.marketGroups}`);
            console.log(`   Types Fetched: ${stats.types}`);
            console.log(`   Avg API Rate: ${stats.avgApiCallsPerSecond} calls/sec`);
            console.log('\n✅ Market groups update completed successfully!');
            
        } catch (error) {
            this.stats.endTime = Date.now();
            console.error('\n❌ Update failed:', error.message);
            if (this.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }
}

// CLI execution with argument parsing
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    args.forEach((arg, index) => {
        switch (arg) {
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--no-backup':
                options.createBackup = false;
                break;
            case '--no-cache':
                options.useCache = false;
                break;
            case '--rate-limit':
                options.rateLimit = parseInt(args[index + 1]) || 150;
                break;
        }
    });
    
    const updater = new EnhancedMarketGroupsUpdater(options);
    updater.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = EnhancedMarketGroupsUpdater;
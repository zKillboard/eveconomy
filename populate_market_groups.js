#!/usr/bin/env node
'use strict';

/**
 * EVE Online Market Groups Updater
 * Updates docs/api/groups.json using ESI (EVE Swagger Interface) endpoints
 * 
 * This script fetches market groups and their associated items from the EVE API
 * and builds a hierarchical structure similar to the existing groups.json format.
 */

const fs = require('fs').promises;
const https = require('https');
const path = require('path');

class MarketGroupsUpdater {
    constructor() {
        this.esiBaseUrl = 'https://esi.evetech.net';
        this.userAgent = 'EVEconomy Market Groups Updater';
        this.rateLimit = 150; // ESI rate limit per second (conservative)
        this.rateLimitWindow = 1000; // 1 second
        this.lastRequestTime = 0;
        this.requestCount = 0;
        this.marketGroups = new Map();
        this.typeInfo = new Map();
        this.outputFile = path.join(__dirname, 'docs', 'api', 'groups.json');
    }

    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Rate limiting for ESI requests
     */
	async enforceRateLimit() {
		return;
        const now = Date.now();
        
        // Reset counter if window has passed
        if (now - this.lastRequestTime >= this.rateLimitWindow) {
            this.requestCount = 0;
            this.lastRequestTime = now;
        }
        
        // If we've hit the rate limit, wait
        if (this.requestCount >= this.rateLimit) {
            const waitTime = this.rateLimitWindow - (now - this.lastRequestTime);
            if (waitTime > 0) {
                console.log(`Rate limiting: waiting ${waitTime}ms`);
                await this.sleep(waitTime);
                this.requestCount = 0;
                this.lastRequestTime = Date.now();
            }
        }
        
        this.requestCount++;
    }

    /**
     * Make HTTP request to ESI API with error handling and retries
     */
    async makeRequest(endpoint, retries = 3) {
        //await this.enforceRateLimit();
        
        return new Promise((resolve, reject) => {
            const url = `${this.esiBaseUrl}${endpoint}`;
            console.log(`Fetching: ${url}`);
            
            const options = {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            };
            
            const req = https.get(url, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            resolve(json);
                        } catch (error) {
                            reject(new Error(`JSON parse error: ${error.message}`));
                        }
                    } else if (res.statusCode === 404) {
                        resolve(null); // Not found is ok for some endpoints
                    } else if (res.statusCode >= 500 && retries > 0) {
                        console.log(`Server error ${res.statusCode}, retrying in 2s...`);
                        setTimeout(() => {
                            this.makeRequest(endpoint, retries - 1)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                if (retries > 0) {
                    console.log(`Request error, retrying: ${error.message}`);
                    setTimeout(() => {
                        this.makeRequest(endpoint, retries - 1)
                            .then(resolve)
                            .catch(reject);
                    }, 1000);
                } else {
                    reject(error);
                }
            });
            
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Make HTTP POST request for bulk operations
     */
    async makeRequestPost(endpoint, postData, retries = 3) {
        //await this.enforceRateLimit();
        
        return new Promise((resolve, reject) => {
            const url = `${this.esiBaseUrl}${endpoint}`;
            console.log(`POST Request: ${url} (${postData.length} items)`);
            
            const postBody = JSON.stringify(postData);
            
            const options = {
                method: 'POST',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postBody)
                }
            };
            
            const req = https.request(url, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            resolve(json);
                        } catch (error) {
                            reject(new Error(`JSON parse error: ${error.message}`));
                        }
                    } else if (res.statusCode >= 500 && retries > 0) {
                        console.log(`Server error ${res.statusCode}, retrying in 2s...`);
                        setTimeout(() => {
                            this.makeRequestPost(endpoint, postData, retries - 1)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                if (retries > 0) {
                    console.log(`POST request error, retrying: ${error.message}`);
                    setTimeout(() => {
                        this.makeRequestPost(endpoint, postData, retries - 1)
                            .then(resolve)
                            .catch(reject);
                    }, 1000);
                } else {
                    reject(error);
                }
            });
            
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('POST request timeout'));
            });
            
            // Send the POST data
            req.write(postBody);
            req.end();
        });
    }

    /**
     * Fetch all market groups from ESI
     */
    async fetchMarketGroups() {
        console.log('Fetching market group IDs...');
        const groupIds = await this.makeRequest('/latest/markets/groups/');
        
        if (!Array.isArray(groupIds)) {
            throw new Error('Failed to fetch market group IDs');
        }
        
        console.log(`Found ${groupIds.length} market groups, fetching details...`);
        
        // Fetch details for each market group
        const batchSize = 50; // Process in batches to avoid overwhelming the API
        for (let i = 0; i < groupIds.length; i += batchSize) {
            const batch = groupIds.slice(i, i + batchSize);
            const promises = batch.map(id => this.fetchMarketGroupDetails(id));
            
            try {
                await Promise.all(promises);
                console.log(`Processed ${Math.min(i + batchSize, groupIds.length)}/${groupIds.length} market groups`);
            } catch (error) {
                console.error(`Error processing batch ${i}-${i + batchSize}:`, error.message);
                // Continue with next batch
            }
            
            // Small delay between batches
            if (i + batchSize < groupIds.length) {
                await this.sleep(100);
            }
        }
        
        console.log('Finished fetching market groups');
    }

    /**
     * Fetch details for a specific market group
     */
    async fetchMarketGroupDetails(groupId) {
        try {
            const groupData = await this.makeRequest(`/latest/markets/groups/${groupId}/`);
            
            if (groupData) {
                this.marketGroups.set(groupId, {
                    id: groupId,
                    name: groupData.name,
                    description: groupData.description,
                    parent_group_id: groupData.parent_group_id,
                    types: groupData.types || []
                });
            }
        } catch (error) {
            console.error(`Failed to fetch market group ${groupId}:`, error.message);
        }
    }

    /**
     * Fetch type information for items using bulk name resolver
     */
    async fetchTypeInformation() {
        console.log('Fetching type information using bulk resolver...');
        
        // Collect all unique type IDs from market groups
        const typeIds = new Set();
        this.marketGroups.forEach(group => {
            if (group.types) {
                group.types.forEach(typeId => typeIds.add(typeId));
            }
        });
        
        console.log(`Found ${typeIds.size} unique types, fetching names in bulk...`);
        
        const typeIdArray = Array.from(typeIds);
        
        // ESI bulk names endpoint accepts up to 1000 IDs per request
        const batchSize = 1000;
        
        for (let i = 0; i < typeIdArray.length; i += batchSize) {
            const batch = typeIdArray.slice(i, i + batchSize);
            
            try {
                await this.fetchTypeNamesBulk(batch);
                console.log(`Processed ${Math.min(i + batchSize, typeIdArray.length)}/${typeIdArray.length} types`);
            } catch (error) {
                console.error(`Error processing bulk names batch ${i}-${i + batchSize}:`, error.message);
                // Fallback to individual requests for this batch
                console.log('Falling back to individual requests for this batch...');
                await this.fetchTypesIndividually(batch);
            }
            
            // Delay between batches
            if (i + batchSize < typeIdArray.length) {
                await this.sleep(200);
            }
        }
        
        console.log('Finished fetching type information');
    }

    /**
     * Fetch type names in bulk using ESI bulk names resolver
     */
    async fetchTypeNamesBulk(typeIds) {
        if (typeIds.length === 0) return;
        
        try {
            // Use bulk names endpoint
            const nameData = await this.makeRequestPost('/latest/universe/names/', typeIds);
            
            if (Array.isArray(nameData)) {
                // Store the names
                nameData.forEach(item => {
                    if (item.id && item.name && item.category === 'inventory_type') {
                        this.typeInfo.set(item.id, {
                            id: item.id,
                            name: item.name,
                            description: '',
                            group_id: null,
                            category_id: null,
                            published: true,
                            market_group_id: null
                        });
                    }
                });
                
                console.log(`Bulk resolved ${nameData.filter(item => item.category === 'inventory_type').length} type names`);
            }
        } catch (error) {
            console.error(`Failed to fetch bulk type names:`, error.message);
            throw error;
        }
    }

    /**
     * Fallback method to fetch types individually
     */
    async fetchTypesIndividually(typeIds) {
        const batchSize = 10;
        for (let i = 0; i < typeIds.length; i += batchSize) {
            const batch = typeIds.slice(i, i + batchSize);
            const promises = batch.map(id => this.fetchTypeDetails(id));
            
            try {
                await Promise.all(promises);
            } catch (error) {
                console.error(`Error in individual fallback batch:`, error.message);
            }
            
            await this.sleep(100);
        }
    }

    /**
     * Fetch details for a specific type/item (fallback method)
     */
    async fetchTypeDetails(typeId) {
        try {
            const typeData = await this.makeRequest(`/latest/universe/types/${typeId}/`);
            
            if (typeData) {
                this.typeInfo.set(typeId, {
                    id: typeId,
                    name: typeData.name,
                    description: typeData.description,
                    group_id: typeData.group_id,
                    category_id: typeData.category_id,
                    published: typeData.published,
                    market_group_id: typeData.market_group_id
                });
            }
        } catch (error) {
            console.error(`Failed to fetch type ${typeId}:`, error.message);
        }
    }

    /**
     * Build hierarchical market group structure
     */
    buildHierarchy() {
        console.log('Building market group hierarchy...');
        
        const hierarchy = {};
        
        // First, find root groups (no parent)
        const rootGroups = Array.from(this.marketGroups.values())
            .filter(group => !group.parent_group_id);
        
        // Build hierarchy recursively
        rootGroups.forEach(group => {
            hierarchy[group.name] = this.buildGroupNode(group);
        });
        
        return hierarchy;
    }

    /**
     * Build a single group node with its children and items
     */
    buildGroupNode(group) {
        const node = {
            id: group.id,
            name: group.name,
            subgroups: {},
            items: {}
        };
        
        // Find child groups
        const childGroups = Array.from(this.marketGroups.values())
            .filter(childGroup => childGroup.parent_group_id === group.id);
        
        childGroups.forEach(childGroup => {
            node.subgroups[childGroup.name] = this.buildGroupNode(childGroup);
        });
        
        // Add items to this group
        if (group.types) {
            group.types.forEach(typeId => {
                const typeData = this.typeInfo.get(typeId);
                if (typeData && typeData.published !== false) {
                    node.items[typeData.name] = {
                        item_id: typeId,
                        name: typeData.name
                    };
                }
            });
        }
        
        return node;
    }

    /**
     * Save the market groups data to file
     */
    async saveToFile(data) {
        console.log(`Saving market groups to ${this.outputFile}...`);
        
        try {
            // Ensure output directory exists
            await fs.mkdir(path.dirname(this.outputFile), { recursive: true });
            
            // Write with pretty formatting
            const jsonString = JSON.stringify(data, null, 2);
            await fs.writeFile(this.outputFile, jsonString, 'utf8');
            
            console.log('Market groups saved successfully!');
            console.log(`File size: ${(Buffer.byteLength(jsonString) / 1024 / 1024).toFixed(2)} MB`);
        } catch (error) {
            console.error('Failed to save file:', error.message);
            throw error;
        }
    }

    /**
     * Main execution function
     */
    async run() {
        const startTime = Date.now();
        console.log('Starting EVE Online Market Groups update...');
        console.log(`ESI Base URL: ${this.esiBaseUrl}`);
        console.log(`Rate Limit: ${this.rateLimit} requests per second`);
        console.log('');
        
        try {
            // Step 1: Fetch all market groups
            await this.fetchMarketGroups();
            console.log(`\nFetched ${this.marketGroups.size} market groups`);
            
            // Step 2: Fetch type information
            await this.fetchTypeInformation();
            console.log(`\nFetched information for ${this.typeInfo.size} types`);
            
            // Step 3: Build hierarchy
            const hierarchy = this.buildHierarchy();
            console.log(`\nBuilt hierarchy with ${Object.keys(hierarchy).length} root categories`);
            
            // Step 4: Save to file
            await this.saveToFile(hierarchy);
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`\n✅ Update completed successfully in ${duration} seconds`);
            
        } catch (error) {
            console.error('\n❌ Update failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// CLI execution
if (require.main === module) {
    const updater = new MarketGroupsUpdater();
    updater.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = MarketGroupsUpdater;

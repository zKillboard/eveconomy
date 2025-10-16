# EVE Online Market Groups Updater

This system provides tools to update and maintain the `docs/api/groups.json` file using EVE Online's ESI (EVE Swagger Interface) API endpoints. The market groups data contains hierarchical information about all tradeable items in EVE Online, organized by categories and subcategories.

## Files Overview

### Core Scripts

1. **`populate_market_groups.js`** - Basic market groups updater
2. **`update_market_groups.js`** - Enhanced version with caching and advanced features  
3. **`validate_market_groups.js`** - Validation tool for the groups.json file

## Features

### Market Groups Updater (`update_market_groups.js`)

- **Hierarchical Structure**: Builds complete market group hierarchy with proper parent-child relationships
- **Rate Limiting**: Respects ESI rate limits (configurable, defaults to 150 req/sec)
- **Error Handling**: Robust error handling with retries for transient failures
- **Caching System**: Optional caching to avoid unnecessary API calls
- **Backup Creation**: Automatically creates backups of existing data
- **Progress Tracking**: Detailed progress reporting and statistics
- **Batch Processing**: Controlled batch processing to manage API load

### Data Structure

The generated `groups.json` follows this hierarchical structure:

```json
{
  "Category Name": {
    "id": 123,
    "name": "Category Name", 
    "subgroups": {
      "Subcategory Name": {
        "id": 456,
        "name": "Subcategory Name",
        "subgroups": {},
        "items": {
          "Item Name": {
            "item_id": 789,
            "name": "Item Name"
          }
        }
      }
    },
    "items": {}
  }
}
```

## Usage

### Basic Update

```bash
# Run basic market groups update
node populate_market_groups.js

# Run enhanced version with default settings
node update_market_groups.js
```

### Enhanced Options

```bash
# Verbose logging
node update_market_groups.js --verbose

# Disable backup creation
node update_market_groups.js --no-backup

# Disable caching
node update_market_groups.js --no-cache

# Custom rate limit (requests per second)
node update_market_groups.js --rate-limit 100

# Combine options
node update_market_groups.js --verbose --rate-limit 50
```

### Validation

```bash
# Validate the current groups.json file
node validate_market_groups.js

# Validate a specific file
node validate_market_groups.js /path/to/groups.json
```

## ESI Endpoints Used

The updater interacts with the following ESI endpoints:

1. **`/latest/markets/groups/`** - Get list of market group IDs
2. **`/latest/markets/groups/{group_id}/`** - Get market group details
3. **`/latest/universe/types/{type_id}/`** - Get type/item information

## Configuration

### Environment Variables

- `ESI_BASE_URL` - ESI base URL (default: https://esi.evetech.net)
- `RATE_LIMIT` - Maximum requests per second (default: 150)

### File Locations

- **Input**: EVE ESI API
- **Output**: `docs/api/groups.json`
- **Backup**: `docs/api/groups.json.backup`  
- **Cache**: `temp/market_groups_cache.json`

## Error Handling

The system handles various error conditions:

- **HTTP 404**: Item/group not found (logged but not fatal)
- **HTTP 420**: Rate limiting by ESI (automatic backoff)
- **HTTP 429**: Rate limiting by ESI (automatic backoff)
- **HTTP 5xx**: Server errors (automatic retry with backoff)
- **Network errors**: Connection issues (retry with exponential backoff)
- **Timeout errors**: Long-running requests (configurable timeout)

## Performance Optimization

### Rate Limiting Strategy

- Conservative default rate limit (150 req/sec)
- Automatic rate limiting enforcement
- ESI error 420 detection and backoff
- Batch processing with controlled concurrency

### Caching System

- 24-hour cache validity by default
- Automatic cache invalidation
- Fallback to API if cache is stale
- Significantly reduces update time for frequent runs

### Memory Management

- Streaming JSON processing for large datasets
- Controlled batch sizes to limit memory usage
- Garbage collection friendly data structures

## Validation Features

The validator checks for:

- **Structure Integrity**: Proper JSON structure and required fields
- **Data Consistency**: Name consistency between keys and values
- **Duplicate Detection**: Identifies duplicate item IDs
- **Completeness**: Ensures all required properties are present
- **Statistics**: Provides comprehensive statistics about the dataset

## Monitoring and Logging

### Log Levels

- **Standard**: Essential progress and error information
- **Verbose**: Detailed API calls and processing information
- **Debug**: Full request/response logging (via environment variables)

### Statistics Reported

- Total execution time
- Number of API calls made
- Market groups and types fetched
- Average API call rate
- File size and memory usage
- Cache hit/miss ratios

## Integration

### As a Module

```javascript
const MarketGroupsUpdater = require('./update_market_groups');

const updater = new MarketGroupsUpdater({
    verbose: true,
    rateLimit: 100,
    outputFile: '/custom/path/groups.json'
});

await updater.run();
```

### Automation

The scripts can be integrated into cron jobs or CI/CD pipelines:

```bash
# Daily update at 2 AM UTC
0 2 * * * cd /path/to/eveconomy && node update_market_groups.js --no-backup

# Validation after update
5 2 * * * cd /path/to/eveconomy && node validate_market_groups.js
```

## Troubleshooting

### Common Issues

1. **Rate Limiting**: If you see many 420 errors, reduce the rate limit
2. **Timeouts**: Increase timeout values for slow connections
3. **Memory Issues**: Reduce batch sizes or disable caching
4. **Cache Issues**: Delete cache file to force fresh fetch

### Debug Mode

Enable debug logging:

```bash
DEBUG=* node update_market_groups.js --verbose
```

### Manual Verification

Compare before/after statistics:

```bash
# Before update
node validate_market_groups.js > before.log

# After update  
node validate_market_groups.js > after.log

# Compare
diff before.log after.log
```

## Dependencies

- **Node.js**: Version 14+ recommended
- **HTTPS**: Built-in Node.js HTTPS module
- **File System**: Built-in Node.js FS module

No external dependencies required for basic functionality.

## License

This tool is part of the EVEconomy project and follows the same license terms.

## Contributing

When modifying the updater:

1. Test with validation script
2. Verify backward compatibility
3. Update documentation
4. Test error handling scenarios
5. Performance test with rate limiting

## API Documentation

For detailed information about EVE ESI endpoints, see:
- [ESI Documentation](https://esi.evetech.net/ui/)
- [EVE Developer Resources](https://developers.eveonline.com/)
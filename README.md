# EVEconomy

**EVEconomy** is a comprehensive EVE Online market analysis platform providing real-time market data, economic insights, and automated data management tools for New Eden's complex economy.

## 🌟 Overview

EVEconomy serves as a central hub for EVE Online economic data, offering:
- **📊 Live Market Data** - Real-time buy/sell orders and market trends
- **🗺️ Structure Tracking** - Player-owned structure market information  
- **📈 Economic Analysis** - Tools for market analysis and profit calculations
- **🤖 Automated Updates** - Self-maintaining data pipeline via ESI API
- **🌐 Web Interface** - User-friendly web platform for market exploration

The platform combines automated data collection with an intuitive web interface, making EVE's market data accessible to traders, industrialists, and economic analysts.

## 🚀 Key Features

### Web Platform
- **Market Browser** - Interactive market group exploration
- **Real-time Orders** - Live buy/sell order tracking
- **Structure Integration** - Player-owned structure market access
- **Economic Dashboard** - Market trends and analysis tools

### Data Management
- **ESI Integration** - Direct connection to EVE's official API
- **Automated Updates** - Self-maintaining data pipeline
- **Market Groups** - Complete item categorization system
- **Structure Discovery** - Automated player structure detection via Adam4Eve

## 🛠️ Getting Started

### 🌐 Live Platform
**EVEconomy is already hosted and available via GitHub Pages** - you don't need to run anything locally to use the platform! Simply visit the live site to access all market data and analysis tools.

### 💻 Local Development (Optional)
If you want to contribute or run a local instance:

```bash
# Navigate to the web files directory
cd docs

# Start the local development server
python3 ../server.py

# Access your local instance at http://localhost:8080
```

### Data Management Tools
```bash
# Update market groups data
./update_groups.sh --enhanced

# Populate player structures
./populate_player_structures.sh

# Validate data integrity
./update_groups.sh --validate
```

## 🤖 Automation

### Scheduled Updates
The platform includes GitHub Actions automation:
- **Weekly Updates** - Runs every Tuesday at 12:00 UTC
- **Manual Triggers** - On-demand updates via Actions tab
- **Smart Commits** - Only updates when changes are detected
- **Performance Optimized** - Uses bulk ESI fetching for efficiency

### Data Pipeline
- **Market Groups** - Automatically updated via ESI API
- **Item Information** - Bulk name resolution for optimal performance
- **Structure Data** - Regular discovery of player-owned structures
- **Quality Assurance** - Automated validation and error detection

## 📁 Project Structure

```
eveconomy/
├── docs/                    # Web platform files
│   ├── index.html          # Main market interface
│   ├── api/groups.json     # Market groups data
│   └── css/, js/, img/     # Web assets
├── .github/workflows/      # Automation workflows
├── archive/                # Legacy components
│   ├── cron/              # Background data tasks
│   ├── www/               # Web server components
│   └── util/              # Utility libraries
├── update_groups.sh        # Market groups updater
├── server.py              # Development web server
└── populate_*.js          # Data population scripts
```

## 📊 API Endpoints

The platform provides JSON API access:
- `docs/api/groups.json` - Complete market groups hierarchy
- `docs/structures.json` - Player structure information

## 🔧 Development

### Requirements
- **Node.js** 18+ (for data management tools)
- **Python 3** (for development server)
- **ESI API Access** (EVE Online's official API)

### Contributing
1. Fork the repository
2. Create your feature branch
3. Test your changes thoroughly
4. Submit a pull request

See [Actions Documentation](.github/ACTIONS_README.md) for automation details.

# GitHub Actions Automation

## Market Groups Auto-Updater

The repository includes an automated GitHub Action that keeps the market groups data current with EVE Online's latest information.

### Schedule
- **Automatic**: Every Tuesday at 12:00 UTC
- **Manual**: Can be triggered manually from the GitHub Actions tab

### What It Does
1. 🚀 Runs the enhanced market groups updater
2. 📊 Fetches latest data from EVE ESI API using bulk optimization
3. 🔄 Updates `docs/api/groups.json` with fresh information
4. 📝 Commits changes automatically (if any detected)
5. 📈 Provides detailed summary of the update process

### Trigger Options

#### Automatic Weekly Updates
The action runs automatically every Tuesday at noon UTC, ensuring your market data stays fresh without manual intervention.

#### Manual Trigger
You can manually trigger the update from the GitHub Actions tab:

1. Go to **Actions** tab in your repository
2. Select **Update Market Groups** workflow
3. Click **Run workflow** button
4. Optionally enable "Force update" to commit even if no changes detected

### Configuration Details

**Update Settings:**
- Uses enhanced updater (`--enhanced`)
- Disables caching (`--no-cache`) for fresh data
- Disables backup (`--no-backup`) to keep workflow clean
- Leverages bulk ESI fetching for 24x performance improvement

**Commit Behavior:**
- Only commits when actual changes are detected
- Creates descriptive commit messages with timestamps
- Includes workflow trigger information
- Can be forced to commit via manual trigger option

### Permissions
The action uses `GITHUB_TOKEN` with standard permissions to:
- Checkout repository code
- Commit updated files
- Push changes back to the main branch

### Monitoring
Each run provides a detailed summary including:
- ✅ Success/failure status
- 📊 Whether changes were detected
- 🕐 Execution timestamp
- 🔄 Trigger source (scheduled vs manual)

### Troubleshooting
If the action fails:
1. Check the **Actions** tab for detailed logs
2. Verify EVE ESI API availability
3. Ensure repository permissions are correct
4. Review the workflow summary for specific error details

The automation ensures your EVE market groups data remains accurate and up-to-date with minimal manual overhead.
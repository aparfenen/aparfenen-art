// ===== ACTIVITY GRAPH VISUALIZATION WITH 12-ROW LAYOUT =====

document.addEventListener('DOMContentLoaded', function() {
  const activityContainer = document.getElementById('activity-chart');
  const tooltip = document.getElementById('activity-tooltip');
  
  if (!activityContainer) {
    console.warn('Activity chart container not found');
    return;
  }
  
  // Collect artworks with dates (ONLY from chronological gallery to avoid duplicates)
  const chronologicalGallery = document.querySelector('#chronological-gallery .gallery');
  const galleryToUse = chronologicalGallery || document.querySelector('.gallery');
  
  const artworks = Array.from(galleryToUse.querySelectorAll('img')).map(img => {
    return {
      dateCreated: img.dataset.dateCreated || '',  
      showDate: img.dataset.date || '', // This is show_date from CSV
      title: img.dataset.title || 'Untitled',
      year: img.dataset.year || '',
      id: img.closest('.art-block')?.id || ''
    };
  }).filter(a => a.showDate); // Only filter by showDate existence
  
  console.log(`Found ${artworks.length} unique artworks with show_date (from chronological gallery)`);
  
  if (artworks.length === 0) {
    activityContainer.innerHTML = '<p style="text-align: center; color: #999;">No date data available</p>';
    return;
  }
  
  // Parse dates from show_date (e.g., "March 2025")
  const monthCounts = {};
  let minYear = null;
  let maxYear = null;
  let parsedCount = 0;
  let failedCount = 0;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  artworks.forEach(artwork => {
    const showDate = artwork.showDate.trim(); // "March 2025"
    
    // Parse "Month YYYY" format  
    const parts = showDate.split(' ');
    if (parts.length >= 2) {
      const monthName = parts[0];
      const yearFromShowDate = parseInt(parts[1]); // Extract year from show_date
      const monthIndex = monthNames.indexOf(monthName);
      
      // Use year from show_date if available, fallback to dataset.year
      let finalYear = yearFromShowDate;
      if (isNaN(finalYear) && artwork.year) {
        finalYear = parseInt(artwork.year);
      }
      
      if (monthIndex !== -1 && !isNaN(finalYear) && finalYear > 1900 && finalYear < 2100) {
        const monthKey = `${finalYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        
        if (!monthCounts[monthKey]) {
          monthCounts[monthKey] = { count: 0, works: [], year: finalYear, month: monthIndex };  
        }
        monthCounts[monthKey].count++;
        monthCounts[monthKey].works.push(artwork.title);
        
        if (minYear === null || finalYear < minYear) minYear = finalYear;
        if (maxYear === null || finalYear > maxYear) maxYear = finalYear;
        parsedCount++;
      } else {
        console.warn(`Could not parse date for "${artwork.title}": showDate="${showDate}", year="${artwork.year}"`);
        failedCount++;
      }
    } else {
      console.warn(`Invalid show_date format for "${artwork.title}": "${showDate}"`);
      failedCount++;
    }
  });
  
  if (minYear === null || maxYear === null) {
    activityContainer.innerHTML = '<p style="text-align: center; color: #999;">Could not parse dates</p>';
    console.error(`Failed to parse dates from artworks. Parsed: ${parsedCount}, Failed: ${failedCount}`);
    return;
  }
  
  console.log(`Year range: ${minYear} to ${maxYear}`);
  console.log(`Successfully parsed: ${parsedCount} artworks, Failed: ${failedCount}`);
  console.log(`Months with activity: ${Object.keys(monthCounts).length}`);
  
  // Calculate max count for color scaling
  const maxCount = Math.max(...Object.values(monthCounts).map(m => m.count), 1);
  
  // Create grid container with month labels
  activityContainer.innerHTML = '';
  const gridContainer = document.createElement('div');
  gridContainer.className = 'activity-grid-container';
  
  // Add month labels column
  const monthLabelsCol = document.createElement('div');
  monthLabelsCol.className = 'month-labels-column';
  
  // Short month names for labels
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  shortMonths.forEach((monthName, idx) => {
    const label = document.createElement('div');
    label.className = 'month-label';
    label.textContent = monthName;
    // Only show every other month label to reduce clutter
    if (idx % 2 === 1) {
      label.style.opacity = '0.5';
    }
    monthLabelsCol.appendChild(label);
  });
  
  gridContainer.appendChild(monthLabelsCol);
  
  // Create the main grid for cells
  const grid = document.createElement('div');
  grid.className = 'activity-grid';
  
  // Calculate number of columns needed (one per year)
  const numYears = maxYear - minYear + 1;
  grid.style.gridTemplateColumns = `repeat(${numYears}, 18px)`;
  
  // Create cells organized by month (row) and year (column)
  // We need to create 12 rows × numYears columns
  for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
    for (let yearOffset = 0; yearOffset < numYears; yearOffset++) {
      const year = minYear + yearOffset;
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const monthData = monthCounts[monthKey];
      
      const cell = document.createElement('div');
      cell.className = 'activity-cell';
      
      const date = new Date(year, monthIdx, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (monthData) {
        cell.title = `${monthName}: ${monthData.count} work${monthData.count !== 1 ? 's' : ''}`;
        
        // Assign grayscale level classes based on count
        const ratio = monthData.count / maxCount;
        let level;
        if (ratio <= 0.2) level = 1;
        else if (ratio <= 0.4) level = 2;
        else if (ratio <= 0.6) level = 3; 
        else if (ratio <= 0.8) level = 4;
        else level = 5;
        cell.classList.add(`level-${level}`);
        
        // Tooltip
        cell.addEventListener('mouseenter', (e) => {
          if (!tooltip) return;
          tooltip.innerHTML = `
            <strong>${monthName}</strong><br>
            ${monthData.count} work${monthData.count !== 1 ? 's' : ''}
            ${monthData.works.length > 0 ? '<br><small>' + monthData.works.slice(0, 3).join(', ') + (monthData.works.length > 3 ? '...' : '') + '</small>' : ''}
          `;
          tooltip.style.display = 'block';
          
          const rect = cell.getBoundingClientRect();
          tooltip.style.left = rect.left + rect.width / 2 + 'px';
          tooltip.style.top = rect.top - 10 + 'px';
        });
        
        cell.addEventListener('mouseleave', () => {
          if (tooltip) tooltip.style.display = 'none';  
        });
      } else {
        // Empty cell
        cell.classList.add('empty');
        cell.title = `${monthName}: 0 works`;
      }
      
      grid.appendChild(cell);
    }
  }
  
  gridContainer.appendChild(grid);
  
  // Add year labels at the bottom
  const yearLabelsRow = document.createElement('div');
  yearLabelsRow.className = 'year-labels-row';
  
  // Empty space for month label column alignment
  const emptySpace = document.createElement('div');
  emptySpace.className = 'month-labels-column';
  emptySpace.style.visibility = 'hidden';
  yearLabelsRow.appendChild(emptySpace);
  
  // Year labels grid
  const yearLabelsGrid = document.createElement('div');
  yearLabelsGrid.className = 'year-labels-grid';
  yearLabelsGrid.style.gridTemplateColumns = `repeat(${numYears}, 18px)`;
  
  for (let yearOffset = 0; yearOffset < numYears; yearOffset++) {
    const year = minYear + yearOffset;
    const yearLabel = document.createElement('div');
    yearLabel.className = 'year-label-item';
    yearLabel.textContent = year;
    yearLabelsGrid.appendChild(yearLabel);
  }
  
  yearLabelsRow.appendChild(yearLabelsGrid);
  
  activityContainer.appendChild(gridContainer);
  activityContainer.appendChild(yearLabelsRow);
  
  // Update stats
  updateStats(artworks, monthCounts);
  
  console.log('✓ Activity chart rendered successfully with 12-row layout');
});

function updateStats(artworks, monthCounts) {
  // Total works
  const totalWorks = document.getElementById('total-works');
  if (totalWorks) totalWorks.textContent = artworks.length;
  
  // Most productive month
  const mostProductive = document.getElementById('most-productive-month');
  if (mostProductive && Object.keys(monthCounts).length > 0) {
    const maxMonth = Object.entries(monthCounts).reduce((max, [key, val]) => 
      val.count > max.count ? { key, count: val.count } : max, 
      { key: '', count: 0 }
    );
    
    if (maxMonth.key) {
      const [year, month] = maxMonth.key.split('-');
      const date = new Date(year, parseInt(month) - 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      mostProductive.textContent = `${monthName} (${maxMonth.count})`;
    }
  }
  
  // Current year count
  const currentYearCount = document.getElementById('current-year-count');
  if (currentYearCount) {
    const currentYear = new Date().getFullYear();
    const thisYearWorks = artworks.filter(a => {
      // Parse year from show_date
      const parts = a.showDate.split(' ');
      if (parts.length >= 2) {
        const year = parseInt(parts[1]);
        return year === currentYear;
      }
      return false;
    }).length;
    currentYearCount.textContent = thisYearWorks;
  }
}

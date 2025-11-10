// ===== ACTIVITY VISUALIZATION =====

document.addEventListener('DOMContentLoaded', function() {
  const activityContainer = document.getElementById('activity-chart');
  const tooltip = document.getElementById('activity-tooltip');
  
  if (!activityContainer) {
    console.warn('Activity chart container not found');
    return;
  }
  
  // Collect artworks with dates
  const artworks = Array.from(document.querySelectorAll('.gallery img')).map(img => {
    return {
      dateCreated: img.dataset.dateCreated || '',
      showDate: img.dataset.date || '', // This is show_date from CSV
      title: img.dataset.title || 'Untitled',
      year: img.dataset.year || ''
    };
  }).filter(a => a.showDate && a.year);
  
  console.log(`Found ${artworks.length} artworks with dates`);
  
  if (artworks.length === 0) {
    activityContainer.innerHTML = '<p style="text-align: center; color: #999;">No date data available</p>';
    return;
  }
  
  // Parse dates from show_date (e.g., "March 2025")
  const monthCounts = {};
  let minDate = null;
  let maxDate = null;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  artworks.forEach(artwork => {
    const showDate = artwork.showDate.trim(); // "March 2025"
    const year = parseInt(artwork.year);
    
    // Parse "Month YYYY" format
    const parts = showDate.split(' ');
    if (parts.length >= 2) {
      const monthName = parts[0];
      const monthIndex = monthNames.indexOf(monthName);
      
      if (monthIndex !== -1 && !isNaN(year)) {
        const date = new Date(year, monthIndex, 1);
        const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
        
        if (!monthCounts[monthKey]) {
          monthCounts[monthKey] = { count: 0, works: [], date: date };
        }
        monthCounts[monthKey].count++;
        monthCounts[monthKey].works.push(artwork.title);
        
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      }
    }
  });
  
  if (!minDate || !maxDate) {
    activityContainer.innerHTML = '<p style="text-align: center; color: #999;">Could not parse dates</p>';
    console.error('Failed to parse dates from artworks');
    return;
  }
  
  console.log(`Date range: ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`);
  console.log(`Months with activity: ${Object.keys(monthCounts).length}`);
  
  // Generate all months in range
  const months = [];
  const current = new Date(minDate);
  current.setDate(1);
  
  while (current <= maxDate) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key: monthKey,
      date: new Date(current),
      count: monthCounts[monthKey]?.count || 0,
      works: monthCounts[monthKey]?.works || []
    });
    current.setMonth(current.getMonth() + 1);
  }
  
  const maxCount = Math.max(...months.map(m => m.count), 1);
  
  // Render activity chart
  activityContainer.innerHTML = '';
  
  months.forEach(month => {
    const cell = document.createElement('div');
    cell.className = 'activity-cell';
    cell.title = `${month.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}: ${month.count} works`;
    
    // Scale opacity based on count
    const opacity = month.count > 0 ? 0.3 + (month.count / maxCount) * 0.7 : 0;
    const color = month.count > 0 ? `rgba(51, 102, 204, ${opacity})` : 'rgba(0, 0, 0, 0.05)';
    cell.style.backgroundColor = color;
    
    // Tooltip
    cell.addEventListener('mouseenter', (e) => {
      if (!tooltip) return;
      const monthName = month.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      tooltip.innerHTML = `
        <strong>${monthName}</strong><br>
        ${month.count} work${month.count !== 1 ? 's' : ''}
        ${month.works.length > 0 ? '<br><small>' + month.works.slice(0, 3).join(', ') + (month.works.length > 3 ? '...' : '') + '</small>' : ''}
      `;
      tooltip.style.display = 'block';
      
      const rect = cell.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + 'px';
      tooltip.style.top = rect.top - 10 + 'px';
    });
    
    cell.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.style.display = 'none';
    });
    
    activityContainer.appendChild(cell);
  });
  
  // Update stats
  updateStats(artworks, monthCounts);
  
  console.log('Activity chart rendered successfully');
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
    const thisYearWorks = artworks.filter(a => parseInt(a.year) === currentYear).length;
    currentYearCount.textContent = thisYearWorks;
  }
}

// ===== ACTIVITY VISUALIZATION =====

document.addEventListener('DOMContentLoaded', function() {
  const activityContainer = document.getElementById('activity-chart');
  const tooltip = document.getElementById('activity-tooltip');
  
  if (!activityContainer) {
    console.warn('Activity chart container not found');
    return;
  }
  
  // Collect all artworks with dates
  const artworks = Array.from(document.querySelectorAll('.gallery img')).map(img => {
    const dateCreated = img.dataset.dateCreated || '';
    const title = img.dataset.title || 'Untitled';
    const year = img.dataset.year || '';
    
    return { dateCreated, title, year };
  }).filter(a => a.dateCreated && a.year);
  
  // Parse dates and group by month
  const monthCounts = {};
  let minDate = null;
  let maxDate = null;
  
  artworks.forEach(artwork => {
    const date = parseDateWithYear(artwork.dateCreated, artwork.year);
    if (!date) return;
    
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthCounts[monthKey]) {
      monthCounts[monthKey] = { count: 0, works: [], date: date };
    }
    monthCounts[monthKey].count++;
    monthCounts[monthKey].works.push(artwork.title);
    
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
  });
  
  if (!minDate || !maxDate) {
    activityContainer.innerHTML = '<p style="text-align: center; color: #999;">No date data available</p>';
    return;
  }
  
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
  
  // Find max count for scaling
  const maxCount = Math.max(...months.map(m => m.count), 1);
  
  // Render activity chart
  activityContainer.innerHTML = '';
  
  months.forEach(month => {
    const cell = document.createElement('div');
    cell.className = 'activity-cell';
    
    // Scale opacity based on count
    const opacity = month.count > 0 ? 0.3 + (month.count / maxCount) * 0.7 : 0.1;
    cell.style.backgroundColor = month.count > 0 ? `rgba(51, 102, 204, ${opacity})` : '#f0f0f0';
    
    // Tooltip on hover
    cell.addEventListener('mouseenter', (e) => {
      const monthName = month.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      tooltip.innerHTML = `
        <strong>${monthName}</strong><br>
        ${month.count} work${month.count !== 1 ? 's' : ''}<br>
        ${month.works.length > 0 ? '<small>' + month.works.slice(0, 3).join(', ') + (month.works.length > 3 ? '...' : '') + '</small>' : ''}
      `;
      tooltip.style.display = 'block';
      
      const rect = cell.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + 'px';
      tooltip.style.top = rect.top - 10 + 'px';
    });
    
    cell.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
    
    activityContainer.appendChild(cell);
  });
  
  // Update stats
  updateStats(artworks, monthCounts);
});

function parseDateWithYear(dateStr, yearStr) {
  if (!dateStr || !yearStr) return null;
  
  const formats = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (m) => new Date(m[3], m[1] - 1, m[2]) },
    { regex: /^(\d{1,2})\/(\d{1,2})$/, parse: (m) => new Date(yearStr, m[1] - 1, 1) },
  ];
  
  for (const fmt of formats) {
    const match = dateStr.match(fmt.regex);
    if (match) return fmt.parse(match);
  }
  
  return null;
}

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
    const thisYearWorks = artworks.filter(a => a.year == currentYear).length;
    currentYearCount.textContent = thisYearWorks;
  }
}

// ===== ACTIVITY VISUALIZATION =====

// Activity data from gallery
const activityData = {
  '2014-05': 1,
  '2014-06': 1,
  '2014-10': 1,
  '2014-11': 1,
  '2021-07': 1,
  '2021-08': 1,
  '2021-12': 1,
  '2022-01': 1,
  '2022-09': 1,
  '2023-07': 1,
  '2024-01': 2,
  '2024-08': 1,
  '2024-11': 1,
  '2024-12': 1,
  '2025-01': 13,
  '2025-03': 5, // Corrected count
  '2025-04': 3,
  '2025-05': 2,
  '2025-06': 10, // Corrected count
  '2025-07': 19,
  '2025-08': 25,
  '2025-09': 12,
  '2025-10': 13,
  '2025-11': 3
};

// Generate comprehensive timeline from first to last work
function generateTimeline() {
  const sortedDates = Object.keys(activityData).sort();
  const firstDate = sortedDates[0].split('-');
  const lastDate = sortedDates[sortedDates.length - 1].split('-');
  
  const startYear = parseInt(firstDate[0]);
  const startMonth = parseInt(firstDate[1]) - 1;
  const endYear = parseInt(lastDate[0]);
  const endMonth = parseInt(lastDate[1]) - 1;
  
  const timeline = [];
  
  // Group by years for better visualization
  for (let year = startYear; year <= endYear; year++) {
    const yearData = {
      year: year,
      months: []
    };
    
    const monthStart = (year === startYear) ? startMonth : 0;
    const monthEnd = (year === endYear) ? endMonth : 11;
    
    for (let month = monthStart; month <= monthEnd; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      yearData.months.push({
        month: month,
        monthKey: monthKey,
        count: activityData[monthKey] || 0
      });
    }
    
    if (yearData.months.length > 0) {
      timeline.push(yearData);
    }
  }
  
  return timeline;
}

// Determine activity level with better thresholds
function getActivityLevel(count) {
  if (count === 0) return 'empty';
  if (count <= 1) return 'level-1';
  if (count <= 3) return 'level-2';
  if (count <= 7) return 'level-3';
  if (count <= 12) return 'level-4';
  if (count <= 18) return 'level-5';
  return 'level-6'; // For exceptional months
}

// Get month name abbreviation
function getMonthName(monthIndex) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[monthIndex];
}

// Generate compact timeline visualization
function generateActivityChart() {
  const chartContainer = document.getElementById('activity-chart');
  if (!chartContainer) {
    console.error('[Activity] Chart container not found');
    return;
  }
  
  const timeline = generateTimeline();
  let html = '<div class="activity-timeline">';
  
  // Create year-based visualization
  timeline.forEach(yearData => {
    // Skip years with no activity at all
    const hasActivity = yearData.months.some(m => m.count > 0);
    if (!hasActivity && yearData.year < 2024) return; // Skip empty early years
    
    html += `
      <div class="activity-year">
        <div class="year-label">${yearData.year}</div>
        <div class="year-months">
    `;
    
    yearData.months.forEach(monthData => {
      const monthName = getMonthName(monthData.month);
      const level = getActivityLevel(monthData.count);
      const displayCount = monthData.count > 0 ? monthData.count : '';
      
      html += `
        <div class="month-box ${level}" 
             data-date="${monthData.monthKey}" 
             data-count="${monthData.count}"
             title="${monthName} ${yearData.year}: ${monthData.count} work${monthData.count !== 1 ? 's' : ''}">
          <span class="month-abbr">${monthName.substring(0, 1)}</span>
          <span class="month-count">${displayCount}</span>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  chartContainer.innerHTML = html;
  
  console.log(`[Activity] Timeline visualization generated`);
}

// Update statistics
function updateStats() {
  // Count total works
  const totalWorks = Object.values(activityData).reduce((sum, count) => sum + count, 0);
  
  // Find most productive month
  let maxMonth = '';
  let maxCount = 0;
  for (const [month, count] of Object.entries(activityData)) {
    if (count > maxCount) {
      maxCount = count;
      maxMonth = month;
    }
  }
  
  const [year, month] = maxMonth.split('-');
  const monthName = getMonthName(parseInt(month) - 1);
  
  // Count works for current year
  const currentYear = new Date().getFullYear();
  const currentYearCount = Object.entries(activityData)
    .filter(([date]) => date.startsWith(String(currentYear)))
    .reduce((sum, [, count]) => sum + count, 0);
  
  // Update elements
  const totalElement = document.getElementById('total-works');
  const productiveElement = document.getElementById('most-productive-month');
  const yearElement = document.getElementById('current-year-count');
  
  if (totalElement) totalElement.textContent = totalWorks;
  if (productiveElement) productiveElement.textContent = `${monthName} ${year} (${maxCount})`;
  if (yearElement) yearElement.textContent = currentYearCount;
  
  console.log(`[Activity] Stats: ${totalWorks} total, peak ${monthName} ${year}`);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  generateActivityChart();
  updateStats();
  console.log('[Activity] Visualization initialized');
});

// Enhanced tooltip interaction
document.addEventListener('mouseover', (e) => {
  if (e.target.classList.contains('month-box')) {
    const tooltip = document.getElementById('activity-tooltip');
    if (tooltip) {
      const count = e.target.dataset.count;
      const date = e.target.dataset.date;
      const [year, month] = date.split('-');
      const monthName = getMonthName(parseInt(month) - 1);
      
      tooltip.textContent = `${monthName} ${year}: ${count} work${count !== '1' ? 's' : ''}`;
      tooltip.style.display = 'block';
      tooltip.style.left = e.pageX + 10 + 'px';
      tooltip.style.top = e.pageY - 30 + 'px';
    }
  }
});

document.addEventListener('mouseout', (e) => {
  if (e.target.classList.contains('month-box')) {
    const tooltip = document.getElementById('activity-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }
});

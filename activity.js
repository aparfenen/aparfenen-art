// ===== ACTIVITY VISUALIZATION =====

// Activity data - будет заполнено из CSV
let activityData = {};

// 1) Загрузка данных из CSV
async function loadActivityFromCSV() {
  try {
    const resp = await fetch('gallery_metadata.csv');
    if (!resp.ok) throw new Error(`Failed to load CSV: ${resp.status}`);
    const text = await resp.text();
    
    // Простой парсинг CSV без библиотек
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const dateIndex = headers.findIndex(h => 
      h === 'date_created' || h === 'date created'
    );
    
    if (dateIndex === -1) {
      console.warn('[Activity] date_created column not found');
      return;
    }
    
    const data = {};
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(',');
      const dateStr = cols[dateIndex]?.trim();
      if (!dateStr) continue;
      
      // Парсим дату MM/DD/YYYY или MM/YYYY или MM/YY
      const parts = dateStr.split('/').map(p => p.trim());
      if (parts.length < 2) continue;
      
      let month = parseInt(parts[0]);
      let year;
      
      if (parts.length === 3) {
        year = parseInt(parts[2]);
      } else if (parts.length === 2) {
        const y = parseInt(parts[1]);
        year = parts[1].length <= 2 ? 2000 + y : y;
      }
      
      if (isNaN(month) || isNaN(year)) continue;
      if (month < 1 || month > 12 || year < 1900 || year > 2100) continue;
      
      const key = `${year}-${String(month).padStart(2, '0')}`;
      data[key] = (data[key] || 0) + 1;
    }
    
    activityData = data;
    console.log(`[Activity] Loaded ${Object.keys(data).length} months from CSV`);
    
  } catch (error) {
    console.error('[Activity] Error loading CSV:', error);
  }
}

// Generate comprehensive timeline from first to last work
function generateTimeline() {
  const sortedDates = Object.keys(activityData).sort();
  if (sortedDates.length === 0) return [];
  
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
  
  // Create year-based visualization - REVERSED ORDER (newest first)
  timeline.reverse().forEach(yearData => {
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
  const counts = Object.values(activityData);
  if (counts.length === 0) return;
  
  // Count total works
  const totalWorks = counts.reduce((sum, count) => sum + count, 0);
  
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
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Activity] Initializing...');
  await loadActivityFromCSV();
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

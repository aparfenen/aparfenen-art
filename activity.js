// ===== ACTIVITY VISUALIZATION (GitHub-style) =====
// Исправленная версия с корректными данными из CSV

// Парсим данные из gallery_metadata.csv
const activityData = {
  '2014-05': 1,  // weird_horse.jpg
  '2014-06': 1,  // 3horses.jpg
  '2014-10': 1,  // core2014.jpg
  '2014-11': 1,  // angel2014.jpg
  '2021-07': 1,  // snail2021.jpg
  '2021-08': 1,  // crustaceans.jpeg
  '2021-12': 1,  // shrimp2021.jpg
  '2022-01': 1,  // fish2022.jpg (date_created=1/1/2022)
  '2022-09': 1,  // blackseabatumi2022.jpg
  '2023-07': 1,  // guppy2023.jpg
  '2024-01': 2,  // lake2024.jpg, angel2024.jpg
  '2024-08': 1,  // daydreaming.jpg
  '2024-11': 1,  // autumn2024.jpg
  '2024-12': 1,  // snail2024.jpg
  '2025-01': 13, // Multiple works
  '2025-03': 4,  // horse2025.jpg, lobster.jpeg, fish2025.jpg, niagarafalls2025.jpg, niagara2025.jpg
  '2025-04': 3,  // faultlines2025.jpg, girlwaiting2025.jpg, body2025.jpg
  '2025-05': 2,  // trypanosoma2025.jpg, darkcity2025.jpg
  '2025-06': 9,  // invasion.jpg, liberty.jpg, boston2025.jpg, dnaflowers2025.jpg, helix2025.jpg, smoking2025.jpg, flowers2025.jpg, sunset2025.jpg, neverwas2025.jpg, abstract2025.jpg
  '2025-07': 19, // Multiple July works
  '2025-08': 25, // Самый продуктивный месяц
  '2025-09': 12, // September works
  '2025-10': 13, // October works
  '2025-11': 3   // November works (survived.jpg, sosurreal.jpg, shore_after_heat.jpg)
};

// Функция для генерации дат за последние 12 месяцев
function generateDateRange() {
  const dates = [];
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  
  let currentDate = new Date(startDate);
  while (currentDate <= today) {
    const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    dates.push({
      date: yearMonth,
      count: activityData[yearMonth] || 0
    });
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return dates;
}

// Функция определения уровня активности
function getActivityLevel(count) {
  if (count === 0) return 'empty';
  if (count <= 2) return 'level-1';
  if (count <= 5) return 'level-2';
  if (count <= 10) return 'level-3';
  if (count <= 15) return 'level-4';
  return 'level-5';
}

// Функция для получения названия месяца
function getMonthName(monthIndex) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[monthIndex];
}

// Генерация HTML графика
function generateActivityChart() {
  const dates = generateDateRange();
  const chartContainer = document.getElementById('activity-chart');
  
  if (!chartContainer) {
    console.error('[Activity] Chart container not found');
    return;
  }
  
  let html = '<div class="activity-grid">';
  
  // Создаем сетку по месяцам (2 колонки для компактности)
  dates.forEach((dateData, index) => {
    const [year, month] = dateData.date.split('-');
    const monthName = getMonthName(parseInt(month) - 1);
    const level = getActivityLevel(dateData.count);
    
    html += `
      <div class="activity-month-cell">
        <div class="activity-month-label">${monthName} ${year}</div>
        <div class="activity-cell ${level}" 
             data-date="${dateData.date}" 
             data-count="${dateData.count}"
             title="${monthName} ${year}: ${dateData.count} work${dateData.count !== 1 ? 's' : ''}">
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  chartContainer.innerHTML = html;
  
  console.log(`[Activity] Chart generated with ${dates.length} months`);
}

// Обновление статистики
function updateStats() {
  // Подсчитываем общее количество работ
  const totalWorks = Object.values(activityData).reduce((sum, count) => sum + count, 0);
  
  // Находим самый продуктивный месяц
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
  
  // Подсчитываем работы за текущий год
  const currentYear = new Date().getFullYear();
  const currentYearCount = Object.entries(activityData)
    .filter(([date]) => date.startsWith(String(currentYear)))
    .reduce((sum, [, count]) => sum + count, 0);
  
  // Обновляем элементы
  const totalElement = document.getElementById('total-works');
  const productiveElement = document.getElementById('most-productive-month');
  const yearElement = document.getElementById('current-year-count');
  
  if (totalElement) totalElement.textContent = totalWorks;
  if (productiveElement) productiveElement.textContent = `${monthName} ${year} (${maxCount})`;
  if (yearElement) yearElement.textContent = currentYearCount;
  
  console.log(`[Activity] Stats updated: ${totalWorks} total, ${maxCount} max in ${monthName} ${year}`);
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  generateActivityChart();
  updateStats();
  console.log('[Activity] Visualization initialized');
});

// Добавляем интерактивность - tooltip при наведении
document.addEventListener('mouseover', (e) => {
  if (e.target.classList.contains('activity-cell')) {
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
  if (e.target.classList.contains('activity-cell')) {
    const tooltip = document.getElementById('activity-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }
});

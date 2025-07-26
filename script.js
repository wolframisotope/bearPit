// Poll data and config
const JSONBIN_BIN_ID = '6884adecae596e708fbc030d';
const JSONBIN_API_KEY = '$2a$10$GEtAM2HEj5cTZA9NJ/snY.N6iBdWmzH2k.Dd2bF/paO4DhaenkgbG';
const USE_FALLBACK = false; // Set to true to use localStorage
let chart = null;

// Time slots in UTC
const timeSlots = [
    { time: '00:00' },
    { time: '01:00' },
    { time: '02:00' },
    { time: '03:00' },
    { time: '04:00' },
    { time: '05:00' },
    { time: '06:00' },
    { time: '07:00' },
    { time: '08:00' },
    { time: '09:00' },
    { time: '10:00' },
    { time: '11:00' },
    { time: '12:00' },
    { time: '13:00' },
    { time: '14:00' },
    { time: '15:00' },
    { time: '16:00' },
    { time: '17:00' },
    { time: '18:00' },
    { time: '19:00' },
    { time: '20:00' },
    { time: '21:00' },
    { time: '22:00' },
    { time: '23:00' }
];

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    generateTimeOptions();
    checkIfVoted();

    // Test connection and initialize if needed
    await testAndInitialize();

    await loadPollData();
    await updateChart();

    document.getElementById('poll-form').addEventListener('submit', handleVote);
});

// Update current UTC time display
function updateCurrentTime() {
    const now = new Date();
    const utcTime = now.toISOString().substr(11, 8) + ' UTC';
    document.getElementById('utc-time').textContent = utcTime;
}

// Generate time option checkboxes
function generateTimeOptions() {
    const container = document.querySelector('.time-options');

    timeSlots.forEach((slot, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'time-option';
        optionDiv.innerHTML = `
            <input type="checkbox" id="time-${index}" value="${slot.time}">
            <div class="time">${slot.time}</div>
        `;

        optionDiv.addEventListener('click', function () {
            const checkbox = this.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            this.classList.toggle('selected', checkbox.checked);
        });

        container.appendChild(optionDiv);
    });
}

// Check if user has already voted
function checkIfVoted() {
    const hasVoted = localStorage.getItem('utc-poll-voted');
    if (hasVoted) {
        disableVoting('Already Voted');
    }
}

// Handle vote submission
async function handleVote(e) {
    e.preventDefault();

    const checkedBoxes = document.querySelectorAll('.time-options input[type="checkbox"]:checked');

    if (checkedBoxes.length === 0) {
        showNotification('Please select at least one time option!', 'error');
        return;
    }

    // Check if already voted
    if (localStorage.getItem('utc-poll-voted')) {
        showNotification('You have already voted!', 'error');
        return;
    }

    const selectedTimes = Array.from(checkedBoxes).map(cb => cb.value);

    try {
        // Get current data
        const currentData = await getPollData();

        // Add votes
        selectedTimes.forEach(time => {
            currentData.votes[time] = (currentData.votes[time] || 0) + 1;
        });

        currentData.totalVotes = (currentData.totalVotes || 0) + 1;

        // Save updated data
        await savePollData(currentData);

        // Mark user as voted
        localStorage.setItem('utc-poll-voted', 'true');

        // Update UI
        await updateChart();
        disableVoting('Vote Submitted!');
        showNotification('Your vote has been recorded!');

    } catch (error) {
        console.error('Error submitting vote:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Disable voting interface
function disableVoting(buttonText) {
    const voteBtn = document.querySelector('.vote-btn');
    if (voteBtn) {
        voteBtn.disabled = true;
        voteBtn.textContent = buttonText;
    }

    document.querySelectorAll('.time-option').forEach(option => {
        option.style.pointerEvents = 'none';
        option.style.opacity = '0.6';
    });
}

// Get poll data from shared storage
async function getPollData() {
    if (USE_FALLBACK) {
        return getFallbackData();
    }

    try {
        console.log(`Fetching data from bin: ${JSONBIN_BIN_ID}`);
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });

        console.log(`Response status: ${response.status}`);

        if (response.ok) {
            const result = await response.json();
            console.log('Fetched data:', result);
            return result.record;
        } else {
            const errorText = await response.text();
            console.error(`API Error ${response.status}:`, errorText);
            throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
        }
    } catch (error) {
        console.error('Error loading poll data:', error);
        // Return default data structure
        const defaultData = {
            votes: {},
            totalVotes: 0
        };

        timeSlots.forEach(slot => {
            defaultData.votes[slot.time] = 0;
        });

        return defaultData;
    }
}

// Save poll data to shared storage
async function savePollData(data) {
    if (USE_FALLBACK) {
        return saveFallbackData(data);
    }

    try {
        console.log(`Saving data to bin: ${JSONBIN_BIN_ID}`, data);
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            },
            body: JSON.stringify(data)
        });

        console.log(`Save response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Save API Error ${response.status}:`, errorText);
            throw new Error(`Failed to save data: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log('Save successful:', result);
        return result;
    } catch (error) {
        console.error('Error saving poll data:', error);
        throw error;
    }
}

// Load existing poll data and update UI
async function loadPollData() {
    const data = await getPollData();
    document.getElementById('total-votes').textContent = data.totalVotes || 0;
}

// Update the results chart
async function updateChart() {
    const pollData = await getPollData();
    const ctx = document.getElementById('results-chart').getContext('2d');

    const labels = timeSlots.map(slot => slot.time);
    const data = timeSlots.map(slot => pollData.votes[slot.time] || 0);

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Votes',
                data: data,
                backgroundColor: 'rgba(188, 106, 106, 0.7)',
                borderColor: 'rgba(139, 69, 19, 0.8)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = pollData.totalVotes || 0;
                            const percentage = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
                            return `${context.parsed.y} votes (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#8B4513'
                    },
                    title: {
                        display: true,
                        text: 'Number of Votes',
                        color: '#BC9A6A',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(210, 180, 140, 0.3)'
                    }
                },
                x: {
                    ticks: {
                        color: '#8B4513'
                    },
                    title: {
                        display: true,
                        text: 'UTC Time',
                        color: '#BC9A6A',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(210, 180, 140, 0.3)'
                    }
                }
            }
        }
    });

    // Update total votes display
    document.getElementById('total-votes').textContent = pollData.totalVotes || 0;
}

// Show notification
function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Test connection and initialize if needed
async function testAndInitialize() {
    console.log('Testing JSONBin connection...');

    try {
        // Try to read the bin
        const data = await getPollData();
        console.log('Current poll data:', data);

        // Check if data structure is valid
        if (!data.votes || !data.hasOwnProperty('totalVotes')) {
            console.log('Invalid data structure, initializing...');
            await initializePoll();
        } else {
            console.log('Poll data is valid');
        }
    } catch (error) {
        console.error('Connection test failed:', error);
        console.log('Attempting to initialize poll...');
        await initializePoll();
    }
}

// Initialize shared storage (run this once to set up the bin)
async function initializePoll() {
    const initialData = {
        votes: {},
        totalVotes: 0
    };

    timeSlots.forEach(slot => {
        initialData.votes[slot.time] = 0;
    });

    try {
        console.log('Initializing poll with data:', initialData);
        await savePollData(initialData);
        console.log('Poll initialized successfully');
        return initialData;
    } catch (error) {
        console.error('Failed to initialize poll:', error);
        showNotification('Failed to connect to voting service', 'error');
        throw error;
    }
}

// For debugging - call this to reset the poll
async function resetPoll() {
    await initializePoll();
    localStorage.removeItem('utc-poll-voted');
    location.reload();
}

// Reset only the local user's vote status
function resetMyVote() {
    localStorage.removeItem('utc-poll-voted');
    console.log('Your vote has been reset. You can now vote again.');
    location.reload();
}

// Fallback functions using localStorage
function getFallbackData() {
    const data = localStorage.getItem('poll-shared-data');
    if (data) {
        console.log('Using fallback data:', JSON.parse(data));
        return JSON.parse(data);
    }

    const defaultData = {
        votes: {},
        totalVotes: 0
    };

    timeSlots.forEach(slot => {
        defaultData.votes[slot.time] = 0;
    });

    return defaultData;
}

function saveFallbackData(data) {
    console.log('Saving fallback data:', data);
    localStorage.setItem('poll-shared-data', JSON.stringify(data));
    return Promise.resolve({ success: true });
}

// Manual test function - call this in console to test API
async function testAPI() {
    console.log('=== API Test Start ===');
    console.log('Bin ID:', JSONBIN_BIN_ID);
    console.log('API Key:', JSONBIN_API_KEY.substring(0, 10) + '...');

    try {
        console.log('Testing READ...');
        const data = await getPollData();
        console.log('READ Success:', data);

        console.log('Testing WRITE...');
        const testData = { votes: { "00:00": 1 }, totalVotes: 1 };
        const result = await savePollData(testData);
        console.log('WRITE Success:', result);

        console.log('=== API Test Complete ===');
        return true;
    } catch (error) {
        console.error('=== API Test Failed ===', error);
        return false;
    }
} 

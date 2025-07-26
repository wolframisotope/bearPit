// Poll data and configuration
const JSONBIN_BIN_ID = '6884adecae596e708fbc030d'; // Replace with your bin ID
const JSONBIN_API_KEY = '$2a$10$GEtAM2HEj5cTZA9NJ/snY.N6iBdWmzH2k.Dd2bF/paO4DhaenkgbG'; // Replace with your API key
let chart = null;

// Time slots (24 hours in UTC)
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
document.addEventListener('DOMContentLoaded', function () {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    generateTimeOptions();
    loadPollData();
    updateChart();
    setupShareLink();
    checkIfVoted();

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
    document.getElementById('vote-btn').disabled = true;
    document.getElementById('vote-btn').textContent = buttonText;

    document.querySelectorAll('.time-option').forEach(option => {
        option.style.pointerEvents = 'none';
        option.style.opacity = '0.6';
    });
}

// Get poll data from shared storage
async function getPollData() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });

        if (response.ok) {
            const result = await response.json();
            return result.record;
        } else {
            throw new Error('Failed to fetch data');
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
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save data');
        }

        return await response.json();
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
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 5,
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
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Number of Votes'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'UTC Time'
                    }
                }
            }
        }
    });

    // Update total votes display
    document.getElementById('total-votes').textContent = pollData.totalVotes || 0;
}

// Setup share link
function setupShareLink() {
    const shareUrl = window.location.href;
    document.getElementById('share-url').value = shareUrl;
}

// Copy share link to clipboard
function copyLink() {
    const shareInput = document.getElementById('share-url');
    shareInput.select();
    shareInput.setSelectionRange(0, 99999); // For mobile devices

    try {
        document.execCommand('copy');
        showNotification('Link copied to clipboard!');
    } catch (err) {
        showNotification('Failed to copy link. Please copy manually.', 'error');
    }
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
        await savePollData(initialData);
        console.log('Poll initialized successfully');
    } catch (error) {
        console.error('Failed to initialize poll:', error);
    }
}

// For debugging - call this to reset the poll
async function resetPoll() {
    await initializePoll();
    localStorage.removeItem('utc-poll-voted');
    location.reload();
} 
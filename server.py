from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

DATA_FILE = 'poll_data.json'
VOTERS_FILE = 'voters.json'


def load_poll_data():
    """Load poll data from JSON file"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)

        # Initialize with 24 hour slots
    time_slots = ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00',
                  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
                  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
                  '19:00', '20:00', '21:00', '22:00', '23:00']

    return {
        'votes': {slot: 0 for slot in time_slots},
        'totalVotes': 0
    }


def save_poll_data(data):
    """Save poll data to JSON file"""
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


def load_voters():
    """Load voters list from JSON file"""
    if os.path.exists(VOTERS_FILE):
        with open(VOTERS_FILE, 'r') as f:
            return json.load(f)
    return []


def save_voters(voters):
    """Save voters list to JSON file"""
    with open(VOTERS_FILE, 'w') as f:
        json.dump(voters, f, indent=2)


def get_client_id(request):
    """Get a simple client identifier (IP + User-Agent hash)"""
    ip = request.remote_addr
    user_agent = request.headers.get('User-Agent', '')
    return f"{ip}_{hash(user_agent) % 10000}"


@app.route('/')
def serve_index():
    """Serve the HTML file"""
    return send_from_directory('.', 'index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('.', filename)


@app.route('/api/poll', methods=['GET'])
def get_poll_data():
    """Get current poll results"""
    data = load_poll_data()
    return jsonify(data)


@app.route('/api/vote', methods=['POST'])
def submit_vote():
    """Submit a vote"""
    client_id = get_client_id(request)
    voters = load_voters()

    # Check if user already voted
    if any(voter['id'] == client_id for voter in voters):
        return jsonify({'error': 'You have already voted!'}), 400

    data = request.get_json()
    selected_times = data.get('selectedTimes', [])

    if not selected_times:
        return jsonify({'error': 'No times selected!'}), 400

    # Load current poll data
    poll_data = load_poll_data()

    # Add votes
    for time_slot in selected_times:
        if time_slot in poll_data['votes']:
            poll_data['votes'][time_slot] += 1

    poll_data['totalVotes'] += 1

    # Save updated data
    save_poll_data(poll_data)

    # Mark user as voted
    voters.append({
        'id': client_id,
        'timestamp': datetime.now().isoformat(),
        'votes': selected_times
    })
    save_voters(voters)

    return jsonify({'success': True, 'message': 'Vote recorded!'})


@app.route('/api/check-voted', methods=['GET'])
def check_voted():
    """Check if user has already voted"""
    client_id = get_client_id(request)
    voters = load_voters()

    has_voted = any(voter['id'] == client_id for voter in voters)
    return jsonify({'hasVoted': has_voted})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get voting statistics"""
    voters = load_voters()
    poll_data = load_poll_data()

    return jsonify({
        'totalVoters': len(voters),
        'totalVotes': poll_data['totalVotes'],
        'votes': poll_data['votes']
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

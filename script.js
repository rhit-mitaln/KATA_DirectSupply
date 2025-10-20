let quizData = [];
// Initializing all the variables
let currentQuestion = 0;
let userScore = 0;
let selectedAnswer = null;
let answered = false;
let timeLeft = 0;
let timerInterval = null;
let leaderboard = JSON.parse(localStorage.getItem('quizLeaderboard')) || [];

const API_URL = 'https://opentdb.com/api.php';

// this is a function to help decode html code
function decodeHTML(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

// Function to fetch questions from the API
async function startQuiz() {
    const category = document.getElementById('category').value;
    const difficulty = document.getElementById('difficulty').value;
    const amount = document.getElementById('amount').value;

    if (!amount || amount < 1 || amount > 50) {
        alert('Please enter a valid number of questions (1-50)');
        return;
    }

    document.querySelector('.setup-section').classList.remove('active');
    document.getElementById('loadingSection').style.display = 'block';

    try {
    let url = `${API_URL}?amount=${amount}&type=multiple`;
    if (category) url += `&category=${category}`;
    if (difficulty) url += `&difficulty=${difficulty}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });
    const data = await response.json();

    if (data.response_code !== 0) {
        throw new Error('Unable to fetch questions. Please try again.');
    }

    // Extracts the appropriate values from the json received from the API
    quizData = data.results.map(q => ({
        question: decodeHTML(q.question),
        correct_answer: decodeHTML(q.correct_answer),
        incorrect_answers: q.incorrect_answers.map(a => decodeHTML(a)),
        all_answers: [decodeHTML(q.correct_answer), ...q.incorrect_answers.map(a => decodeHTML(a))].sort(() => Math.random() - 0.5)
    }));

    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('quizSection').classList.add('active');
    currentQuestion = 0;
    userScore = 0;
    selectedAnswer = null;
    answered = false;
    timeLeft = quizData.length * 30;

    displayQuestion();
    startTimer();

    } catch (error) {

        // Error handling to display an appropriate error message in case the loading of the question fails
        console.error('Fetch error:', error);
        document.getElementById('loadingSection').innerHTML = `
        <div class="error">
            <strong>Connection Error</strong><br>
                ${error.message || 'Unable to load trivia questions. Please check your internet connection and try again.'}
        </div>
        <button class="btn-start" onclick="location.reload()">Try Again</button>
           `;
    }
        }

// function to display the questions and update values
function displayQuestion() {
    const question = quizData[currentQuestion];
    const progress = ((currentQuestion + 1) / quizData.length) * 100;

    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('questionNumber').textContent = `Question ${currentQuestion + 1} of ${quizData.length}`;
    document.getElementById('questionText').textContent = question.question;

    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    question.all_answers.forEach(answer => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.textContent = answer;
        optionDiv.onclick = () => selectAnswer(answer);
        optionsContainer.appendChild(optionDiv);
    });

    selectedAnswer = null;
    answered = false;
    document.getElementById('nextBtn').disabled = true;
    updateButton();
}

// function that handles the moment the user enters their selected answer
function selectAnswer(answer) {
    if (answered) return;

    selectedAnswer = answer;
    const options = document.querySelectorAll('.option');
    const question = quizData[currentQuestion];

    options.forEach(opt => {
        opt.classList.remove('selected');
        if (opt.textContent === answer) {
            opt.classList.add('selected');
        }
    });

    document.getElementById('nextBtn').disabled = false;
}

// Handles displaying the next question
function nextQuestion() {
    if (!selectedAnswer) return;

    const question = quizData[currentQuestion];
    const options = document.querySelectorAll('.option');

    options.forEach(opt => {
        if (opt.textContent === question.correct_answer) {
            opt.classList.add('correct');
        } else if (opt.textContent === selectedAnswer && selectedAnswer !== question.correct_answer) {
            opt.classList.add('incorrect');
        }
        opt.onclick = null;
        opt.style.cursor = 'default';
    });

    if (selectedAnswer === question.correct_answer) {
        userScore++;
    }

    answered = true;
    document.getElementById('nextBtn').textContent = currentQuestion === quizData.length - 1 ? 'See Results' : 'Next Question';

    setTimeout(() => {
        currentQuestion++;
        if (currentQuestion < quizData.length) {
            displayQuestion();
            document.getElementById('nextBtn').textContent = 'Next Question';
        } else {
            endQuiz();
        }
    }, 2000);
}

// Function to initialize the 5 minute timer
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimer();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endQuiz();
        }
    }, 1000);
}

// displays the timer on the screen
function updateTimer() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timerEl = document.getElementById('timer');
    timerEl.textContent = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;

    if (timeLeft <= 30) {
        timerEl.classList.add('warning');
    } else {
        timerEl.classList.remove('warning');
    }
}

// Handles the feedback generation and getting the leaderboard from the updateLeaderboard function
function endQuiz() {
    clearInterval(timerInterval);
    document.getElementById('quizSection').classList.remove('active');
    document.getElementById('resultsSection').classList.add('active');

    const percentage = (userScore / quizData.length) * 100;
    document.getElementById('scoreDisplay').textContent = `${userScore}/${quizData.length}`;

    let feedbackClass = 'poor';
    let feedbackText = 'Keep practicing! You\'ll improve with more quizzes.';

    if (percentage >= 90) {
        feedbackClass = 'excellent';
        feedbackText = 'Outstanding! You\'re a quiz master!';
    } else if (percentage >= 70) {
        feedbackClass = 'good';
        feedbackText = 'Great job! You know your stuff!';
    } else if (percentage >= 50) {
        feedbackClass = 'average';
        feedbackText = 'Not bad! Review and try again to improve.';
    }

    const feedbackContainer = document.getElementById('feedbackContainer');
    feedbackContainer.className = `feedback ${feedbackClass}`;
    feedbackContainer.textContent = feedbackText;

    updateLeaderboard();
}

// Stores the top 10 scores and re-calculates them everytime the new quiz is finished
function updateLeaderboard() {
    const entry = {
        score: userScore,
        total: quizData.length,
        percentage: Math.round((userScore / quizData.length) * 100),
        date: new Date().toLocaleDateString()
    };

    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.percentage - a.percentage);
    leaderboard = leaderboard.slice(0, 10);

    localStorage.setItem('quizLeaderboard', JSON.stringify(leaderboard));

    const leaderboardEl = document.getElementById('leaderboard');
    leaderboardEl.innerHTML = '<div class="leaderboard-title">Top 10 Scores</div>';

    leaderboard.forEach((entry, index) => {
        leaderboardEl.innerHTML += `
            <div class="leaderboard-item">
                <span class="leaderboard-rank">#${index + 1}</span>
                <span>${entry.score}/${entry.total} (${entry.percentage}%)</span>
                <span class="leaderboard-score">${entry.date}</span>
            </div>
        `;
    });
}

// Goes back to the quiz state when and if the user wants to play another quiz
function restartQuiz() {
    document.getElementById('resultsSection').classList.remove('active');
    document.querySelector('.setup-section').classList.add('active');
}

// 
function goHome() {
    location.reload();
}

// Makes sure the user picks a value
function updateButton() {
    const btn = document.getElementById('nextBtn');
    btn.textContent = selectedAnswer ? 'Next Question' : 'Select an answer';
}
import { SENTENCES } from './sentences.js';

// DOM Elements
const levelFilter = document.getElementById('levelFilter');
const typeFilter = document.getElementById('typeFilter');
const sentenceContainer = document.getElementById('sentenceContainer');
const checkBtn = document.getElementById('checkBtn');
const nextBtn = document.getElementById('nextBtn');
const translateBtn = document.getElementById('translateBtn');

const feedbackContainer = document.getElementById('feedbackContainer');
const feedbackMessage = document.getElementById('feedbackMessage');
const correctAnswersDisplay = document.getElementById('correctAnswersDisplay');

const translationContainer = document.getElementById('translationContainer');
const fullItalianSentence = document.getElementById('fullItalianSentence');
const russianTranslation = document.getElementById('russianTranslation');

const statTotalEl = document.getElementById('statTotal');
const statCorrectEl = document.getElementById('statCorrect');
const statPercentageEl = document.getElementById('statPercentage');

const helpBtn = document.getElementById('helpBtn');
const closeHelpBtn = document.getElementById('closeHelpBtn');
const helpModal = document.getElementById('helpModal');

// Tooltip Element
const wordTooltip = document.createElement('div');
wordTooltip.className = 'word-tooltip';
document.body.appendChild(wordTooltip);
let tooltipTimeout;
let tooltipCache = {};

// State state
let currentSentence = null;
let currentInputs = [];
let hasChecked = false;

// Statistics state
let stats = {
  total: 0,
  correct: 0
};

// Help Modal logic
helpBtn.addEventListener('click', () => {
  helpModal.classList.remove('hidden');
});

closeHelpBtn.addEventListener('click', () => {
  helpModal.classList.add('hidden');
});

// Click outside modal to close
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) {
    helpModal.classList.add('hidden');
  }
});

// Update Statistics Display
function updateStatsDisplay() {
  statTotalEl.textContent = stats.total;
  statCorrectEl.textContent = stats.correct;
  
  const percentage = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
  statPercentageEl.textContent = `${percentage}%`;
}

// Filter sentences based on current selections and logic
function getFilteredSentences() {
  const level = levelFilter.value; // "all", "A1", "A2"
  const type = typeFilter.value;   // "all", "definite", "indefinite"

  return SENTENCES.filter(s => {
    // Level filter
    if (level === 'A1' && s.level !== 'A1') return false;
    // Note: 'A2' in the select means "including A2", so we effectively allow all levels.
    // However, if the user explicitly meant ONLY A2, you can adjust this logic, but
    // the UI says "A1-A2 (всё)" vs "Только A1" vs "Включая A2"

    // Type filter
    if (type !== 'all' && s.type !== type && s.type !== 'mixed') return false;

    return true;
  });
}

function getRandomSentence() {
  const filtered = getFilteredSentences();
  if (filtered.length === 0) {
    return null;
  }

  // We want to give a ~35% chance to pick a multi-gap sentence if one exists
  const multiGaps = filtered.filter(s => s.articles.length > 1);
  const singleGaps = filtered.filter(s => s.articles.length === 1);

  if (multiGaps.length > 0 && singleGaps.length > 0) {
    const isMultiGapTime = Math.random() < 0.35;
    const targetPool = isMultiGapTime ? multiGaps : singleGaps;
    const randomIndex = Math.floor(Math.random() * targetPool.length);
    return targetPool[randomIndex];
  } else {
    // If we only have one type available, just pick purely random
    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex];
  }
}

function renderSentence(sentenceObj) {
  if (!sentenceObj) {
    sentenceContainer.innerHTML = '<p class="placeholder-text">Нет подходящих предложений для этих фильтров.</p>';
    checkBtn.disabled = true;
    translateBtn.disabled = true;
    return;
  }

  currentSentence = sentenceObj;
  hasChecked = false;
  currentInputs = [];
  
  // Hide feedback and translations
  feedbackContainer.classList.add('hidden');
  translationContainer.classList.add('hidden');

  // Split text by "___" and insert inputs
  const parts = sentenceObj.text.split('___');
  sentenceContainer.innerHTML = '';
  
  const sentenceP = document.createElement('p');
  sentenceP.className = 'sentence-text';

  parts.forEach((part, index) => {
    // Wrap words in interactive spans, keeping punctuation outside
    const words = part.split(/(\s+|[,.?!;:])/g).filter(Boolean);
    
    words.forEach(word => {
      // Check if word contains any actual letters before making it hoverable
      if (/[a-zA-ZÀ-ÿ]/.test(word)) {
        const span = document.createElement('span');
        span.className = 'interactive-word';
        span.textContent = word;
        
        span.addEventListener('mouseenter', (e) => showWordTooltip(word, e));
        span.addEventListener('mouseleave', hideWordTooltip);
        
        sentenceP.appendChild(span);
      } else {
        // Just text node for spaces/punctuation
        sentenceP.appendChild(document.createTextNode(word));
      }
    });
    
    // Add input if it's not the last part
    if (index < parts.length - 1) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'article-input';
      input.autocomplete = 'off';
      input.setAttribute('data-index', index);
      
      // Auto-focus next input on pressing Enter
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const nextInput = currentInputs[index + 1];
          if (nextInput) {
            nextInput.focus();
          } else {
            checkBtn.click();
          }
        }
      });

      // Enable check button once user types something
      input.addEventListener('input', () => {
        // If they type, enable check button. If they had checked before and are retrying, we allow checking again.
        checkBtn.disabled = false;
        
        // Remove error classes if they start typing again
        input.classList.remove('incorrect');
      });

      currentInputs.push(input);
      sentenceP.appendChild(input);
    }
  });

  sentenceContainer.appendChild(sentenceP);
  checkBtn.disabled = false;
  translateBtn.disabled = false;
  
  // Auto-focus first input
  if (currentInputs.length > 0) {
    setTimeout(() => currentInputs[0].focus(), 50);
  }
}

// Word Tooltip Logic
async function showWordTooltip(word, event) {
  clearTimeout(tooltipTimeout);
  
  // Quick delay to avoid flashing on passing mouseovers
  tooltipTimeout = setTimeout(async () => {
    // 1. Calculate absolute position relative to the entire document
    const targetElement = event.target;
    // Bounding rect relative to the viewport
    const rect = targetElement.getBoundingClientRect(); 
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // We position the tooltip container centrally above the word
    // The CSS transform: translateX(-50%) handles the exact horizontal centering
    const leftPos = rect.left + scrollX + (rect.width / 2);
    
    // Position it 8px above the top of the word
    // We update this value again dynamically after text is inserted because width/height might change
    const getTopPos = () => rect.top + scrollY - 8 - wordTooltip.offsetHeight;

    wordTooltip.style.left = `${leftPos}px`;
    wordTooltip.style.top = `${getTopPos()}px`;
    
    const cleanWord = word.replace(/[.,?!:;'"’]/g, '').trim().toLowerCase();
    
    // If we have it in cache, show instantly
    if (tooltipCache[cleanWord]) {
      wordTooltip.textContent = tooltipCache[cleanWord];
      wordTooltip.style.top = `${getTopPos()}px`;
      wordTooltip.classList.add('visible');
      return;
    }
    
    // Show loading state
    wordTooltip.textContent = '...';
    wordTooltip.style.top = `${getTopPos()}px`;
    wordTooltip.classList.add('visible');
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanWord,
          sourceLang: 'IT',
          targetLang: 'RU'
        })
      });
      
      const data = await response.json();
      if (response.ok && data.translation) {
        tooltipCache[cleanWord] = data.translation.toLowerCase();
        wordTooltip.textContent = tooltipCache[cleanWord];
      } else {
        wordTooltip.textContent = "Ошибка";
      }
      
      // Final pixel-perfect reposition after content has loaded and height is stable
      wordTooltip.style.top = `${getTopPos()}px`;
      
    } catch (error) {
      wordTooltip.textContent = "Нет связи";
      wordTooltip.style.top = `${getTopPos()}px`;
    }
  }, 100); 
}

function hideWordTooltip() {
  clearTimeout(tooltipTimeout);
  wordTooltip.classList.remove('visible');
}

// Normalize apostrophes and lowercase
function normalizeAnswer(str) {
  return str.trim().toLowerCase().replace(/['´`’]/g, "'");
}

function checkAnswers() {
  if (!currentSentence) return;
  
  // Notice we don't return if hasChecked is true anymore, 
  // because we want them to be able to click check again for corrected answers.
  hasChecked = true;
  checkBtn.disabled = true;

  let allCorrect = true;

  currentInputs.forEach((input, index) => {
    // Skip if they already got this specific input correct
    if (input.readOnly) return;

    const userAnswer = normalizeAnswer(input.value);
    const correctAnswer = normalizeAnswer(currentSentence.articles[index]);

    if (userAnswer === correctAnswer) {
      input.classList.remove('incorrect');
      input.classList.add('correct');
      // Lock correct answers
      input.readOnly = true;
    } else {
      input.classList.add('incorrect');
      allCorrect = false;
    }
  });

  // Only increment stats if it's their FIRST time checking this sentence, 
  // or decide how you want to track stats for retries. 
  // Let's keep it simple: count total attempts every time they check, but correct only if they got it all right.
  stats.total++;
  
  if (allCorrect) {
    stats.correct++;
    feedbackMessage.textContent = 'Верно! Отлично!';
    feedbackMessage.className = 'feedback-message message-correct';
    // Reveal correct answers purely for confirmation
    correctAnswersDisplay.textContent = `Правильные артикли: ${currentSentence.articles.join(', ')}`;
    feedbackContainer.classList.remove('hidden');
  } else {
    feedbackMessage.textContent = 'Неправильно. Попробуйте исправить выделенные поля.';
    feedbackMessage.className = 'feedback-message message-incorrect';
    feedbackContainer.classList.remove('hidden');
    // Hide the answers display if they need to try again
    correctAnswersDisplay.textContent = ''; 
    
    // Focus the first incorrect input for convenience
    const firstIncorrect = currentInputs.find(input => !input.readOnly);
    if (firstIncorrect) {
      firstIncorrect.focus();
    }
  }

  // Update displayed translation string if the translation box is already open
  if (!translationContainer.classList.contains('hidden')) {
    fullItalianSentence.textContent = getItalianSentenceForTranslation();
  }

  updateStatsDisplay();
}

function getItalianSentenceForTranslation() {
  if (!currentSentence) return '';
  const parts = currentSentence.text.split('___');
  let result = '';
  
  parts.forEach((part, index) => {
    result += part;
    if (index < parts.length - 1) {
      if (hasChecked) {
        // Show correct article if already checked
        result += currentSentence.articles[index];
      } else {
        // Use user's input if they typed something, otherwise use placeholder '___' 
        // We use the correct article for purely the API translation query behind the scenes, 
        // but display the gaps on screen. 
        // For the DeepL API, it's better to translate the *full correct sentence*, 
        // we'll handle this separation in handleTranslation().
        let userVal = currentInputs[index].value.trim();
        result += userVal ? userVal : '___';
      }
    }
  });
  
  return result.replace(/l' /gi, "l'").replace(/un' /gi, "un'"); 
}

// Complete sentence ONLY used for DeepL API context (invisible to user unless checked)
function getSecretFullSentence() {
  if (!currentSentence) return '';
  const parts = currentSentence.text.split('___');
  let result = '';
  parts.forEach((part, index) => {
    result += part;
    if (index < parts.length - 1) {
      result += currentSentence.articles[index];
    }
  });
  return result.replace(/l' /gi, "l'").replace(/un' /gi, "un'"); 
}

async function handleTranslation() {
  if (!currentSentence) return;
  
  translationContainer.classList.remove('hidden');
  
  // Display string (with gaps or user answers if not checked)
  fullItalianSentence.textContent = getItalianSentenceForTranslation();
  
  russianTranslation.textContent = 'Загрузка перевода...';
  
  // The string being translated by the backend API should be the real correct one
  // so the translation is accurate, even if the user hasn't seen the answers yet.
  const apiSentence = getSecretFullSentence();

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: apiSentence,
        sourceLang: 'IT',
        targetLang: 'RU'
      })
    });

    const data = await response.json();

    if (response.ok && data.translation) {
      russianTranslation.textContent = data.translation;
    } else {
      console.error("Translate error:", data.error);
      russianTranslation.textContent = 'Ошибка загрузки перевода. ' + (data.error || '');
    }
  } catch (error) {
    console.error("Network or parsing error:", error);
    russianTranslation.textContent = 'Нет связи с сервером перевода. Убедитесь, что сервер запущен и API ключ валиден.';
  }
}

// Event Listeners
nextBtn.addEventListener('click', () => {
  renderSentence(getRandomSentence());
});

checkBtn.addEventListener('click', checkAnswers);
translateBtn.addEventListener('click', handleTranslation);

// Re-render when filters change
levelFilter.addEventListener('change', () => {
  renderSentence(getRandomSentence());
});
typeFilter.addEventListener('change', () => {
  renderSentence(getRandomSentence());
});

// Initial render
updateStatsDisplay();
renderSentence(getRandomSentence());

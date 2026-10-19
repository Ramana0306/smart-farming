
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";


const API_URL = import.meta.env.VITE_API_URL;


const NAV_ITEMS = [
  { id: "dashboard", icon: "⌂", label: "Dashboard" },
  { id: "assistant", icon: "🎙", label: "AI Assistant" },
  { id: "community", icon: "♧", label: "Community" },
];

function formatDate(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently"
    : date.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function getInitial(email = "") {
  return email.trim().charAt(0).toUpperCase() || "F";
}

async function apiRequest(path, options = {}, token = null) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      throw new Error("Your session may have expired. Please log in again.");
    }
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Request failed (${response.status}).`
    );
  }

  return data;
}

function Icon({ children }) {
  return <span className="ui-icon" aria-hidden="true">{children}</span>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [activeView, setActiveView] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResult, setAssistantResult] = useState(null);
  const [assistantError, setAssistantError] = useState("");
  const [language, setLanguage] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const recognitionRef = useRef(null);

  const [answerDrafts, setAnswerDrafts] = useState({});
  const [answerLoading, setAnswerLoading] = useState({});
  const [answerMessages, setAnswerMessages] = useState({});

  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    setQuestionsError("");

    try {
      const data = await apiRequest("/community/questions");
      setQuestions(Array.isArray(data) ? data : []);
    } catch (error) {
      setQuestionsError(error.message);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadQuestions();
  }, [user, loadQuestions]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  }

  function startListening() {
    setSpeechMessage("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechMessage(
        "Speech recognition is not supported in this browser. Try a supported browser or type your question."
      );
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setListening(true);
        setSpeechMessage("Listening… Speak your farming question.");
      };

      recognition.onresult = (event) => {
        let transcript = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript;
        }

        setAssistantQuestion(transcript.trim());
      };

      recognition.onerror = (event) => {
        setSpeechMessage(
          event.error === "not-allowed"
            ? "Microphone permission was denied. Allow microphone access in your browser."
            : `Speech recognition error: ${event.error}. You can type your question instead.`
        );
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setListening(false);
      setSpeechMessage("Could not start the microphone. Please try again.");
    }
  }

  function speakAnswer() {
    const answer =
      assistantResult?.status === "answered"
        ? assistantResult.answer
        : assistantResult?.message;

    if (!answer || !("speechSynthesis" in window)) {
      setSpeechMessage("Spoken playback is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(answer);
    utterance.lang = language;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setAuthMessage("");
    setAuthLoading(true);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";

      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (mode === "register") {
        setMode("login");
        setPassword("");
        setAuthMessage("Account created successfully. Please log in.");
      } else {
        setUser({
          email: email.trim().toLowerCase(),
          token: data.access_token,
        });
        setPassword("");
        setActiveView("dashboard");
      }
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    stopListening();
    setUser(null);
    setQuestions([]);
    setEmail("");
    setPassword("");
    setAssistantQuestion("");
    setAssistantResult(null);
    setSearch("");
    setAssistantError("");
    setActiveView("dashboard");
    setAuthMessage("");
  }

  async function askAssistant(event) {
    event.preventDefault();

    const question = assistantQuestion.trim();

    if (question.length < 3) {
      setAssistantError("Please enter a little more detail.");
      return;
    }

    setAssistantLoading(true);
    setAssistantError("");
    setAssistantResult(null);

    try {
      const result = await apiRequest(
        "/assistant/ask",
        {
          method: "POST",
          body: JSON.stringify({ question }),
        },
        user.token
      );

      setAssistantResult(result);

      if (result.status === "community") {
        await loadQuestions();
      }
    } catch (error) {
      setAssistantError(error.message);
    } finally {
      setAssistantLoading(false);
    }
  }

  async function submitAnswer(event, questionId) {
    event.preventDefault();

    const content = (answerDrafts[questionId] || "").trim();

    if (!content) {
      setAnswerMessages((previous) => ({
        ...previous,
        [questionId]: "Please enter an answer first.",
      }));
      return;
    }

    setAnswerLoading((previous) => ({
      ...previous,
      [questionId]: true,
    }));

    setAnswerMessages((previous) => ({
      ...previous,
      [questionId]: "",
    }));

    try {
      await apiRequest(
        `/community/questions/${questionId}/answers`,
        {
          method: "POST",
          body: JSON.stringify({ content }),
        },
        user.token
      );

      setAnswerDrafts((previous) => ({
        ...previous,
        [questionId]: "",
      }));

      setAnswerMessages((previous) => ({
        ...previous,
        [questionId]: "Answer posted successfully.",
      }));

      await loadQuestions();
    } catch (error) {
      setAnswerMessages((previous) => ({
        ...previous,
        [questionId]: error.message,
      }));
    } finally {
      setAnswerLoading((previous) => ({
        ...previous,
        [questionId]: false,
      }));
    }
  }

  const filteredQuestions = questions.filter((question) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      question.title?.toLowerCase().includes(query) ||
      String(question.user_id).includes(query) ||
      question.answers?.some((answer) =>
        answer.content?.toLowerCase().includes(query)
      )
    );
  });

  const answerCount = questions.reduce(
    (total, question) => total + (question.answers?.length || 0),
    0
  );

  function navigate(view) {
    setActiveView(view);
    setMobileNavOpen(false);

    if (view === "community" || view === "myQuestions") {
      loadQuestions();
    }
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-visual">
          <a className="brand auth-brand" href="#home">
            <span className="brand-mark">🌱</span>
            <span className="brand-copy">
              <strong>Smart Farming</strong>
              <small>AI ASSISTANT</small>
            </span>
          </a>

          <div className="auth-visual-content">
            <p className="eyebrow">GROW KNOWLEDGE. GROW BETTER.</p>
            <h1>Grow smarter with shared farming knowledge.</h1>
            <p className="auth-description">
              Ask farming questions, learn from fellow farmers, and discover
              practical guidance from verified knowledge.
            </p>

            <div className="auth-feature-list">
              <span>✓ Verified farming knowledge</span>
              <span>✓ Community farming support</span>
              <span>✓ Voice and text questions</span>
            </div>
          </div>

          <div className="auth-visual-bottom">
            SMART FARMING · KNOWLEDGE · COMMUNITY
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-form-wrap">
            <p className="eyebrow">
              {mode === "login" ? "WELCOME BACK" : "JOIN THE COMMUNITY"}
            </p>

            <h2>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>

            <p className="muted auth-subtitle">
              {mode === "login"
                ? "Sign in to continue your farming journey."
                : "Join farmers who share knowledge and help one another."}
            </p>

            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "auth-tab selected" : "auth-tab"}
                onClick={() => {
                  setMode("login");
                  setAuthMessage("");
                }}
              >
                Sign in
              </button>

              <button
                type="button"
                className={mode === "register" ? "auth-tab selected" : "auth-tab"}
                onClick={() => {
                  setMode("register");
                  setAuthMessage("");
                }}
              >
                Register
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuth}>
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={255}
                required
              />

              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder={
                  mode === "register"
                    ? "At least 8 characters"
                    : "Enter your password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "register" ? 8 : 1}
                maxLength={128}
                required
              />

              {authMessage && (
                <div className="notice" role="status">
                  {authMessage}
                </div>
              )}

              <button
                className="button button-primary full-button"
                type="submit"
                disabled={authLoading}
              >
                {authLoading
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in to your account →"
                    : "Create my account →"}
              </button>
            </form>

            <p className="auth-footer">
              Use this community respectfully and share helpful knowledge.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          className="mobile-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <a
          className="brand"
          href="#dashboard"
          onClick={(event) => {
            event.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-mark">🌱</span>
          <span className="brand-copy">
            <strong>Smart Farming</strong>
            <small>AI ASSISTANT</small>
          </span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="side-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={
                activeView === item.id ? "nav-item active" : "nav-item"
              }
              onClick={() => navigate(item.id)}
            >
              <Icon>{item.icon}</Icon>
              <span>{item.label}</span>
              {item.id === "community" && (
                <span className="nav-count">{questions.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-help">
          <div className="help-icon">✦</div>
          <strong>Knowledge grows when shared.</strong>
          <p>Ask questions or help another farmer with your experience.</p>
          <button
            className="button button-outline full-button"
            onClick={() => navigate("assistant")}
          >
            Ask the assistant
          </button>
        </div>

        <div className="sidebar-profile">
          <div className="avatar">{getInitial(user.email)}</div>
          <div className="profile-info">
            <strong>{user.email.split("@")[0]}</strong>
            <small>{user.email}</small>
          </div>
          <button
            className="icon-button"
            title="Log out"
            aria-label="Log out"
            onClick={logout}
          >
            ↪
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            ☰
          </button>

          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>
              {NAV_ITEMS.find((item) => item.id === activeView)?.label ||
                "Dashboard"}
            </strong>
          </div>

          <div className="topbar-right">
            <span className="connection-indicator">
              <span className="status-dot" />
              Community
            </span>
            <button
              className="avatar small-avatar profile-shortcut"
              onClick={() => navigate("profile")}
              aria-label="Open profile"
            >
              {getInitial(user.email)}
            </button>
          </div>
        </header>

        <div className="content-area">
          {activeView === "dashboard" && (
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">YOUR FARMING WORKSPACE</p>
                  <h1>Welcome back, {user.email.split("@")[0]}! 👋</h1>
                  <p className="muted">
                    Grow better with verified knowledge and your farming community.
                  </p>
                </div>
              </section>

              <section className="welcome-banner dashboard-banner">
                <div className="banner-copy">
                  <span className="banner-pill">🌾 FARMER KNOWLEDGE HUB</span>
                  <h2>Better farming starts with the right question.</h2>
                  <p>
                    Ask using your voice or text. If verified knowledge is
                    unavailable, your question can reach the farming community.
                  </p>
                  <button
                    className="button banner-button"
                    onClick={() => navigate("assistant")}
                  >
                    Ask your farming assistant →
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="sun" />
                  <div className="field field-one" />
                  <div className="field field-two" />
                  <div className="plant plant-one">🌿</div>
                  <div className="plant plant-two">🌱</div>
                  <div className="plant plant-three">🌾</div>
                </div>
              </section>

              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-icon green-icon">☷</div>
                  <div>
                    <span className="stat-label">COMMUNITY QUESTIONS</span>
                    <strong className="stat-value">{questions.length}</strong>
                    <span className="stat-caption">Available discussions</span>
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-icon gold-icon">✉</div>
                  <div>
                    <span className="stat-label">ANSWERS SHARED</span>
                    <strong className="stat-value">{answerCount}</strong>
                    <span className="stat-caption">Community responses</span>
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-icon blue-icon">✓</div>
                  <div>
                    <span className="stat-label">ACCOUNT STATUS</span>
                    <strong className="stat-value">Active</strong>
                    <span className="stat-caption">Signed in</span>
                  </div>
                </article>
              </section>

              <section className="dashboard-quick-actions">
                <div className="feed-heading">
                  <div>
                    <h2>Quick actions</h2>
                    <p className="muted">Choose what you want to do next.</p>
                  </div>
                </div>

                <div className="quick-action-grid">
                  <button
                    className="quick-action-card"
                    onClick={() => navigate("assistant")}
                  >
                    <span className="quick-action-icon">🎙</span>
                    <strong>Ask assistant</strong>
                    <small>Voice or text</small>
                  </button>
                  <button
                    className="quick-action-card"
                    onClick={() => navigate("community")}
                  >
                    <span className="quick-action-icon">♧</span>
                    <strong>Community</strong>
                    <small>Browse discussions</small>
                  </button>
                  <button
                    className="quick-action-card"
                    onClick={() => navigate("knowledge")}
                  >
                    <span className="quick-action-icon">▤</span>
                    <strong>Knowledge base</strong>
                    <small>Verified information</small>
                  </button>
                  <button
                    className="quick-action-card"
                    onClick={() => navigate("myQuestions")}
                  >
                    <span className="quick-action-icon">☷</span>
                    <strong>My questions</strong>
                    <small>View discussions</small>
                  </button>
                </div>
              </section>

              <section className="feed-section">
                <div className="feed-heading">
                  <div>
                    <h2>Latest discussions</h2>
                    <p className="muted">See what farmers are discussing.</p>
                  </div>
                  <button
                    className="button button-outline"
                    onClick={() => navigate("community")}
                  >
                    View community →
                  </button>
                </div>

                {questions.slice(0, 3).map((question) => (
                  <article className="question-card" key={question.id}>
                    <div className="question-topline">
                      <strong>Farmer #{question.user_id}</strong>
                      <span className="discussion-tag">
                        {question.answers?.length
                          ? "Community discussion"
                          : "Needs an answer"}
                      </span>
                    </div>
                    <h3 className="question-title">{question.title}</h3>
                    <p className="muted">
                      {question.answers?.length || 0} answers ·{" "}
                      {formatDate(question.created_at)}
                    </p>
                  </article>
                ))}
              </section>
            </>
          )}

          {activeView === "assistant" && (
            <section className="assistant-page">
              <div className="assistant-intro">
                <p className="eyebrow">VERIFIED FARMING KNOWLEDGE</p>
                <h1>Ask your farming assistant</h1>
                <p className="muted">
                  Speak or type your question. The assistant searches your
                  existing verified knowledge service; unanswered questions
                  can be shared with the community.
                </p>
              </div>

              <div className="assistant-card">
                <div className="assistant-language-row">
                  <label htmlFor="speech-language">Question language</label>
                  <select
                    id="speech-language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                  >
                    <option value="en-IN">English</option>
                    <option value="ta-IN">தமிழ் (Tamil)</option>
                  </select>
                </div>

                <button
                  type="button"
                  className={`microphone-button ${listening ? "is-listening" : ""}`}
                  onClick={listening ? stopListening : startListening}
                  aria-label={listening ? "Stop listening" : "Start voice input"}
                >
                  <span>{listening ? "■" : "🎙"}</span>
                </button>

                <h2>{listening ? "Listening to you…" : "Tap to speak"}</h2>
                <p className="muted voice-caption">
                  Ask in English or Tamil. You can edit the transcription below.
                </p>

                {speechMessage && (
                  <p className="inline-message" role="status">
                    {speechMessage}
                  </p>
                )}

                <form className="question-form" onSubmit={askAssistant}>
                  <label htmlFor="assistant-question">
                    Your farming question
                  </label>
                  <textarea
                    id="assistant-question"
                    rows={4}
                    maxLength={1000}
                    minLength={3}
                    placeholder="Example: What could cause yellow leaves on my paddy crop?"
                    value={assistantQuestion}
                    onChange={(event) => setAssistantQuestion(event.target.value)}
                    required
                  />

                  <div className="form-helper">
                    <span>Uses your existing local knowledge endpoint.</span>
                    <span>{assistantQuestion.length}/1000</span>
                  </div>

                  {assistantError && (
                    <p className="inline-message" role="alert">
                      {assistantError}
                    </p>
                  )}

                  <button
                    className="button button-primary full-button"
                    type="submit"
                    disabled={assistantLoading || listening}
                  >
                    {assistantLoading
                      ? "Searching verified knowledge…"
                      : "Search knowledge base →"}
                  </button>
                </form>

                {assistantResult && (
                  <div className="assistant-result" role="status">
                    <span className="result-status">
                      {assistantResult.status === "answered"
                        ? "✓ VERIFIED ANSWER"
                        : "♧ COMMUNITY QUESTION"}
                    </span>
                    <h3>
                      {assistantResult.status === "answered"
                        ? "Answer from your knowledge base"
                        : "Your question needs community help"}
                    </h3>
                    <p>
                      {assistantResult.status === "answered"
                        ? assistantResult.answer
                        : assistantResult.message}
                    </p>

                    {assistantResult.source && (
                      <p>
                        <strong>Source:</strong> {assistantResult.source}
                      </p>
                    )}

                    <div className="result-actions">
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={speakAnswer}
                      >
                        🔊 Read answer aloud
                      </button>
                      {assistantResult.status === "community" && (
                        <button
                          type="button"
                          className="button button-primary"
                          onClick={() => navigate("community")}
                        >
                          View community →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeView === "community" && (
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">YOUR FARMING COMMUNITY</p>
                  <h1>Farming community</h1>
                  <p className="muted">
                    Real questions. Shared experience. Better farming together.
                  </p>
                </div>
                <button
                  className="button button-outline"
                  onClick={loadQuestions}
                  disabled={questionsLoading}
                >
                  ↻ {questionsLoading ? "Refreshing…" : "Refresh"}
                </button>
              </section>

              <section className="welcome-banner">
                <div className="banner-copy">
                  <span className="banner-pill">🌾 FARMERS HELPING FARMERS</span>
                  <h2>Good farming knowledge is worth sharing.</h2>
                  <p>
                    Questions without a verified answer can be shared here
                    through the assistant.
                  </p>
                  <button
                    className="button banner-button"
                    onClick={() => navigate("assistant")}
                  >
                    Ask farming assistant →
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="sun" />
                  <div className="field field-one" />
                  <div className="field field-two" />
                  <div className="plant plant-one">🌿</div>
                  <div className="plant plant-two">🌱</div>
                  <div className="plant plant-three">🌾</div>
                </div>
              </section>

              <section className="feed-section">
                <div className="search-row">
                  <span className="search-symbol">⌕</span>
                  <input
                    type="search"
                    placeholder="Search questions or answers…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search community"
                  />
                  <span className="result-count">
                    {filteredQuestions.length} results
                  </span>
                </div>

                {questionsError && (
                  <div className="error-panel">
                    <strong>Couldn't load community questions</strong>
                    <p>{questionsError}</p>
                    <button className="button button-outline" onClick={loadQuestions}>
                      Try again
                    </button>
                  </div>
                )}

                {questionsLoading && questions.length === 0 && (
                  <div className="empty-state">
                    <h3>Loading community feed…</h3>
                  </div>
                )}

                {!questionsLoading &&
                  !questionsError &&
                  filteredQuestions.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-symbol">🌱</div>
                      <h3>
                        {search
                          ? "No matching questions"
                          : "No community questions yet"}
                      </h3>
                      <p>
                        {search
                          ? "Try another search."
                          : "When the assistant cannot find an approved answer, questions can appear here."}
                      </p>
                      <button
                        className="button button-primary"
                        onClick={() => navigate("assistant")}
                      >
                        Ask the assistant
                      </button>
                    </div>
                  )}

                <div className="question-list">
                  {filteredQuestions.map((question) => (
                    <article className="question-card" key={question.id}>
                      <div className="question-topline">
                        <div className="question-author">
                          <div className="avatar question-avatar">
                            {getInitial(String(question.user_id))}
                          </div>
                          <div>
                            <strong>Farmer #{question.user_id}</strong>
                            <span>{formatDate(question.created_at)}</span>
                          </div>
                        </div>
                        <span className="discussion-tag">
                          {question.answers?.length
                            ? "Community discussion"
                            : "Needs an answer"}
                        </span>
                      </div>

                      <h3 className="question-title">{question.title}</h3>

                      <div className="question-actions">
                        <span className="answer-count">
                          ▤ {question.answers?.length || 0} answers
                        </span>
                        <button
                          className="text-button"
                          onClick={() =>
                            setExpandedQuestion(
                              expandedQuestion === question.id
                                ? null
                                : question.id
                            )
                          }
                        >
                          {expandedQuestion === question.id
                            ? "Hide discussion ↑"
                            : "View & answer →"}
                        </button>
                      </div>

                      {expandedQuestion === question.id && (
                        <div className="answer-section">
                          <h4>Community answers</h4>

                          {question.answers?.length > 0 ? (
                            question.answers.map((answer) => (
                              <div className="answer-item" key={answer.id}>
                                <div className="answer-meta">
                                  <strong>Farmer #{answer.user_id}</strong>
                                  <span>{formatDate(answer.created_at)}</span>
                                </div>
                                <p>{answer.content}</p>
                              </div>
                            ))
                          ) : (
                            <p className="muted no-answers">
                              No answers yet. Your experience could help.
                            </p>
                          )}

                          <form
                            className="answer-form"
                            onSubmit={(event) =>
                              submitAnswer(event, question.id)
                            }
                          >
                            <label htmlFor={`answer-${question.id}`}>
                              Your answer
                            </label>
                            <textarea
                              id={`answer-${question.id}`}
                              rows={3}
                              maxLength={5000}
                              placeholder="Share useful advice from your experience…"
                              value={answerDrafts[question.id] || ""}
                              onChange={(event) =>
                                setAnswerDrafts((previous) => ({
                                  ...previous,
                                  [question.id]: event.target.value,
                                }))
                              }
                              required
                            />
                            {answerMessages[question.id] && (
                              <p className="inline-message" role="status">
                                {answerMessages[question.id]}
                              </p>
                            )}
                            <button
                              className="button button-primary"
                              type="submit"
                              disabled={answerLoading[question.id]}
                            >
                              {answerLoading[question.id]
                                ? "Posting…"
                                : "Post answer"}
                            </button>
                          </form>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}


          {activeView === "profile" && (
            <section className="standalone-panel">
              <p className="eyebrow">ACCOUNT SETTINGS</p>
              <h1>My profile</h1>
              <div className="profile-card">
                <div className="avatar profile-large-avatar">
                  {getInitial(user.email)}
                </div>
                <div>
                  <h2>{user.email.split("@")[0]}</h2>
                  <p className="muted">{user.email}</p>
                  <span className="discussion-tag">Registered farmer</span>
                </div>
              </div>
              <div className="knowledge-notice">
                <h3>Account security</h3>
                <p>
                  Your account is signed in using your existing authentication
                  endpoint.
                </p>
                <button className="button button-outline" onClick={logout}>
                  Log out
                </button>
              </div>
            </section>
          )}

          <footer className="app-footer">
            <span>🌱 Smart Farming AI Assistant</span>
            <span>Growing through shared knowledge.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

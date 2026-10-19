# 🌾 Smart Farming Assistant

**A multilingual farming support platform that helps farmers find verified agricultural information and connect with a farming community.**

[🌐 Live Application](https://smart-farming-lilac.vercel.app/) · [⚙️ API Documentation](https://smart-farming-api-70uh.onrender.com/docs) · [📂 GitHub Repository](https://github.com/Ramana0306/smart-farming)

---

## 📌 Overview

Smart Farming Assistant is a full-stack web application designed to make agricultural knowledge more accessible to farmers.

Users can ask farming-related questions in English or Tamil. The application searches a knowledge base of reviewed agricultural information and returns a relevant answer with its source when a suitable match is found. If no sufficiently relevant answer is available, the application allows the question to be shared with the farming community so other farmers can contribute answers.

The project focuses on multilingual accessibility, verified knowledge retrieval, and community-driven knowledge sharing.

## ✨ Features

- 🌱 **Farming Knowledge Assistant** — Searches a database of agricultural questions and answers.
- 🌐 **English and Tamil Support** — Accepts questions in English and Tamil and returns an answer in the available language where possible.
- 📚 **Source-Aware Answers** — Displays the source associated with a matched knowledge-base entry.
- 👥 **Community Question Sharing** — Unanswered questions can be added to the community for other farmers to answer.
- 🔐 **User Authentication** — Supports farmer registration and login.
- 🗄️ **Database Integration** — Uses PostgreSQL to store application data.
- 🚀 **Cloud Deployment** — Frontend and backend are deployed separately for public access.
- 📖 **REST API Documentation** — Provides interactive API documentation through FastAPI Swagger UI.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Python, FastAPI |
| API | REST |
| Database | PostgreSQL |
| ORM / Database Access | SQLAlchemy |
| Authentication | JWT-based authentication |
| Password Security | Password hashing |
| Deployment | Vercel, Render |
| Database Hosting | Neon PostgreSQL |

## 🏗️ Application Architecture

```text
                 Farmer
                    |
                    v
          React + Vite Frontend
                    |
               REST API
                    |
                    v
             FastAPI Backend
                    |
          +---------+----------+
          |                    |
          v                    v
   Knowledge Search      Community Questions
          |                    |
          v                    v
  Verified Knowledge     Farmer Contributions
          |                    |
          +---------+----------+
                    |
                    v
             PostgreSQL
```

### How it works

1. A farmer registers or logs in.
2. The farmer submits a question in English or Tamil.
3. The backend searches the verified knowledge-base entries.
4. If a sufficiently relevant entry with an answer is found, the API returns the answer and its source.
5. If no suitable answer is found, the application creates or reuses a community question.
6. Other farmers can view community questions and submit answers.

**Important:** The current assistant uses knowledge-base keyword matching. It is not a generative AI model, and its matching results should be validated before agricultural advice is relied upon.

## 🌐 Live Demo

| Resource | Link |
|---|---|
| Web Application | https://smart-farming-lilac.vercel.app/ |
| Backend API | https://smart-farming-api-70uh.onrender.com |
| Interactive API Docs | https://smart-farming-api-70uh.onrender.com/docs |
| Source Code | https://github.com/Ramana0306/smart-farming |

The application is publicly hosted. Backend services on free hosting plans may take some time to wake up after periods of inactivity.


## 🔮 Future Enhancements

- Semantic search for questions with different wording.
- AI-assisted answers grounded in trusted agricultural documents.
- Voice-based question input and spoken answers.
- Improved Tamil-language understanding.
- Expert review and moderation of community contributions.
- Automated tests, API monitoring, and improved error reporting.
- Better accessibility and mobile usability.

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork this repository.
2. Create a feature branch.
3. Make your changes and test them.
4. Commit and push your changes.
5. Open a pull request describing your contribution.

Please avoid including credentials or private user data in issues and pull requests.

## 👨‍💻 Author

**Ramana M.**

B.Tech Information Technology

[GitHub Profile](https://github.com/Ramana0306)

---

If you find this project useful, consider giving the repository a ⭐ on GitHub.


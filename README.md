<div align="center">
  <h1>🎤 Realtime Mock Interview Coach</h1>
  <p><strong>AI-Powered Mock Interview Platform with Real-Time Feedback</strong></p>
  <p>Practice your interview skills with an AI interviewer and receive comprehensive feedback on your communication, body language, and content quality. Paste a Job Description to get tailored interview questions!</p>
</div>

---

## ✨ Features

- **Real-Time AI Interviewer**: Conduct mock interviews with Alex, an AI-powered interview coach
- **Job Description Support**: Paste a JD to get role-specific interview questions tailored to the position
- **Live Video Analysis**: Camera-based body language and presence analysis
- **Audio Transcription**: Real-time transcription of both candidate and interviewer speech
- **Comprehensive Feedback**: Detailed post-interview analysis including:
  - Communication analysis (pace, clarity, filler words, structure)
  - Body language assessment (eye contact, posture, facial expressions, gestures)
  - Content quality evaluation (specificity, relevance, depth)
  - JD alignment assessment (how well answers match job requirements)
  - Actionable improvement suggestions
- **Modern UI**: Beautiful, responsive interface with dark theme
- **Accessibility**: Built with accessibility best practices

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**
- **Gemini API Key** ([Get one here](https://aistudio.google.com/apikey))
- **Webcam and Microphone** (for video/audio features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/CONFUZ3/interviewcoach.git
   cd interviewcoach
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:3000` (or the port shown in your terminal)

## 📖 Usage

1. **Paste a Job Description (Optional but Recommended)**
   - Before starting, paste the Job Description in the right panel
   - The AI will tailor questions to the specific role and requirements
   - This helps you practice for the exact position you're applying to

2. **Start the Interview**
   - Click the "Start Interview" button
   - Allow camera and microphone access when prompted
   - Wait for the AI interviewer (Alex) to begin

3. **During the Interview**
   - Answer questions naturally
   - The AI will ask follow-up questions based on your responses
   - Questions will be relevant to the JD if one was provided
   - Your video feed and live transcript are displayed in real-time

4. **End the Interview**
   - Click "End Session" when finished
   - Wait for feedback generation (analyzes transcript and video frames)
   - Review your comprehensive feedback report

5. **Review Feedback**
   - Check your strengths and areas for improvement
   - Review communication analysis and body language assessment
   - See how well your answers aligned with the JD requirements
   - Follow the actionable next steps provided

## 🛠️ Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling (via CDN)
- **Google Gemini API** - AI interview coach and feedback generation
- **Web Audio API** - Real-time audio processing
- **MediaStream API** - Camera and microphone access

## 📁 Project Structure

```
realtime-mock-interview-coach/
├── components/
│   ├── FeedbackList.tsx      # Feedback display component
│   ├── InterviewerAvatar.tsx  # AI coach avatar with animations
│   └── VideoPreview.tsx       # Camera preview and frame capture
├── services/
│   └── audio-processing.ts    # Audio encoding/decoding utilities
├── App.tsx                    # Main application component
├── index.tsx                  # Application entry point
├── types.ts                   # TypeScript type definitions
├── vite.config.ts            # Vite configuration
└── package.json              # Dependencies and scripts
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Your Google Gemini API key | Yes |

### Build for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## 🎯 Features in Detail

### Job Description Integration

- Paste any job description before starting your interview
- The AI extracts key requirements, skills, and responsibilities
- Questions are tailored to assess your fit for the specific role
- Feedback evaluates how well your answers aligned with JD requirements

### Real-Time Interview

- Uses Gemini's native audio model for natural conversation
- Supports interruptions and natural dialogue flow
- Adaptive questioning based on your responses and the JD

### Video Analysis

- Captures frames at regular intervals during the interview
- Analyzes body language, eye contact, and presence
- Provides specific feedback on non-verbal communication

### Feedback Generation

- Combines transcript analysis with video frame analysis
- Uses Gemini 3 Flash for comprehensive feedback
- Structured feedback format with actionable insights
- JD-specific feedback on role alignment

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [Google Gemini API](https://ai.google.dev/)
- UI inspired by modern design systems
- Icons from [Heroicons](https://heroicons.com/)

## ⚠️ Important Notes

- **Privacy**: All audio and video processing happens in your browser. Video frames are only sent to the API for feedback generation.
- **API Costs**: This application uses the Gemini API, which may incur costs based on your usage. Check [Google's pricing](https://ai.google.dev/pricing) for details.
- **Browser Compatibility**: Requires modern browsers with Web Audio API and MediaStream support (Chrome, Firefox, Edge, Safari).

## 🐛 Troubleshooting

### Microphone/Camera Not Working

- Ensure you've granted browser permissions
- Check that no other application is using your camera/microphone
- Try refreshing the page and granting permissions again

### API Key Issues

- Verify your API key is correct in `.env.local`
- Ensure the file is named `.env.local` (not `.env`)
- Restart the dev server after adding/changing the API key

### Connection Errors

- Check your internet connection
- Verify your API key has the necessary permissions
- Check browser console for detailed error messages

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/CONFUZ3/interviewcoach/issues) page
2. Create a new issue with details about your problem
3. Include browser version and error messages if applicable

---

<div align="center">
  <p>Made with ❤️ using React and Google Gemini</p>
  <p>⭐ Star this repo if you find it helpful!</p>
</div>

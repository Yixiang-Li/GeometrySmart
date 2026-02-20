<div align="center">
</div>

# Geometry Smart

> Bridging the gap between abstract mathematics and tangible understanding through Constructivist AI.

*(The following infographic details the research, UX/UI design, and technical architecture of Geometry Smart.)*

![Geometry Smart Portfolio Presentation](./GeometrySmart.jpg)

---

# Run and deploy  AI Studio app

This contains everything you need to run the app locally.

View app in AI Studio: https://ai.studio/apps/drive/1TMjLcIJH86Ye_TDbbrFBNVdWZxo56g2B

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Project Overview

### 🚨 The Problem: The Cognitive Gap
The disconnect between abstract math and tangible understanding is a significant hurdle in education. Current solutions fail because they rely on rote memorization, passive learning, and limited 2D static diagrams that fail to convey 3D spatial relationships.
* **78%** of students struggle with abstract concepts.
* **92%** report high anxiety levels.

### ✨ The Solution: Intelligent User Journey
Geometry Smart normalizes multi-modal inputs (Textbook Problems and Free-form Sketches) into personalized, scaffolded learning experiences.
* **Engage Immediately:** Students interact with dynamic 3D models right from the start via a scroll-driven experience.
* **Draw Naturally:** The system recognizes intent, converting rough hand-drawings into perfect geometric forms instantly.
* **Learn via Guided Dialogue:** Learners actively follow the AI's Socratic questioning, connecting textual concepts to spatial structure.

### ⚙️ Technical Deep Dive

**1. The 3D Engine (WebGL / Three.js)**
* **Scroll-Driven Procedural State:** Maps continuous user scroll input to discrete geometric states using real-time interpolation and physics-based damping.
* **Real-time Vector Smoothing:** Converts raw, noisy input coordinates into elegant geometric curves on the fly using Quadratic Bezier interpolation.
* **High-Fidelity PBR Material:** Simulates high-end optical dielectrics (e.g., refraction, absorption) using physically based rendering properties like optical transmission and realistic volume thickness.

**2. AI Architecture: Client-Side RAG**
Grounding Large Language Models in mathematical truth via high-speed, privacy-first Retrieval-Augmented Generation for hallucination-free pedagogy.
* **Workflow:** Local Knowledge Base (Structured JSON) -> Deterministic Heuristic Retrieval (Client-Side) -> Context Integration Layer -> LLM API Streaming Response.

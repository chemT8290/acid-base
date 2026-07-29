export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      code: 'METHOD_NOT_ALLOWED', 
      message: 'POST 메서드만 허용됩니다.' 
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      success: false, 
      code: 'AI_API_NOT_CONFIGURED', 
      message: '서버 환경변수에 OPENAI_API_KEY가 설정되지 않았습니다.' 
    });
  }

  const { studentEvidence, teacherOptions } = req.body;
  if (!studentEvidence || !studentEvidence.student) {
    return res.status(400).json({ 
      success: false, 
      code: 'INVALID_STUDENT_EVIDENCE', 
      message: '분석할 학생 데이터가 유효하지 않습니다.' 
    });
  }

  const systemPrompt = `당신은 고등학교 화학 교사의 평가 및 학생부 기록 업무를 보조하는 전문 AI입니다.

제공된 자료는 학생이 수행한 「식초 품질 검증 프로젝트(아세트산 중화 적정)」의 실제 제출 증거입니다.
학생의 탐구 과정, 실험 데이터, 1차 미분 기반 당량점 판단, 몰농도/산도 계산, 오차 원인 분석, AI 비판적 검증 기록, 활동 소감 등을 종합 분석하여 교사용 피드백 초안, 평가 루브릭 추천 수준, 교과세특 참고 문장을 작성하세요.

[작성 및 평가 원칙]
1. 입력 자료에 명시된 사실만을 근거로 작성하고 추정하여 과장하지 마세요.
2. 성실성, 리더십, 인성 등에 대해 근거 없는 추측 평가를 금지합니다.
3. 단순히 글자 수나 결과값 정답 여부만 보지 말고, 데이터 해석 및 화학적 인과관계 사고 과정을 분석하세요.
4. 계산 오류가 있다면 어느 단계(몰수 계산, 희석배수 미적용, 질량백분율 환산 등)에서 발생했는지 명확히 짚어주세요.
5. AI 대화 검증에 대해 AI 제안을 수용/거부한 주체적 판단 근거를 평가하세요.
6. 학생용 피드백과 교과세특 문장을 엄격히 분리하세요.
7. 학생용 피드백에는 평가 등급이나 세특 내용을 포함하지 마세요.
8. 교과세특 참고 문체는 교사 관찰자 관점(~함, ~도출함, ~고찰함)을 유지하고 학생 실명이나 닉네임을 절대 넣지 마세요.
9. 응답은 반드시 지정된 JSON 구조로만 반환하세요.`;

  const userPrompt = `[교사 설정 옵션]
- 피드백 분량: ${teacherOptions?.feedbackLength || '보통'}
- 세특 분량: ${teacherOptions?.recordLength || '표준형'}
- 세특 강조 역량: ${teacherOptions?.recordFocus || '균형형'}

[학생 제출 수행 증거 데이터]
${JSON.stringify(studentEvidence, null, 2)}

[응답 요구 JSON 구조]
{
  "evidenceSummary": {
    "concept": ["확인된 근거"],
    "experiment": ["확인된 근거"],
    "dataAnalysis": ["확인된 근거"],
    "calculation": ["확인된 근거"],
    "errorAnalysis": ["확인된 근거"],
    "aiLiteracy": ["확인된 근거"]
  },
  "rubric": {
    "concept": { "suggestedLevel": 1, "reason": "화학 개념 이해 근거 요약" },
    "experiment": { "suggestedLevel": 1, "reason": "실험 수행 정밀도 근거 요약" },
    "dataAnalysis": { "suggestedLevel": 1, "reason": "적정곡선/미분 데이터 해석 근거" },
    "calculation": { "suggestedLevel": 1, "reason": "농도 수기 계산 및 산도 환산 근거" },
    "errorAnalysis": { "suggestedLevel": 1, "reason": "오차 원인 진단 근거" },
    "aiLiteracy": { "suggestedLevel": 1, "reason": "AI 검증 비판적 수용 근거" }
  },
  "studentFeedback": {
    "strength": "잘한 점 (구체적 수행 증거 포함)",
    "improvement": "보완할 점 (실행 가능한 조언)",
    "revisionQuestions": [
      "생각을 확장하는 수정 질문 1",
      "생각을 확장하는 수정 질문 2"
    ],
    "nextInquiry": "다음 심화 탐구 제안 문장",
    "overallTeacherFeedback": ""
  },
  "subjectRecord": {
    "focus": "${teacherOptions?.recordFocus || '균형형'}",
    "short": "핵심형 문장 (약 250~350 Bytes)",
    "standard": "표준형 문장 (약 450~650 Bytes)",
    "detailed": "상세형 문장 (약 700~900 Bytes)"
  },
  "warnings": []
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'OpenAI API 호출 실패');
    }

    const data = await response.json();
    const resultJson = JSON.parse(data.choices[0].message.content);

    return res.status(200).json(resultJson);
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      code: 'AI_RESPONSE_ERROR', 
      message: error.message 
    });
  }
}
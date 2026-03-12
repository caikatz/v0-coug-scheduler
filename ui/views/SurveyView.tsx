// const currentQuestion = SURVEY_QUESTIONS[currentQuestionIndex]

//     return (
//       <div className="min-h-screen bg-background flex items-center justify-center p-4">
//         <Card className="w-full max-w-md p-8 text-center relative">
//           {/* Back arrow - only show if not on first question */}
//           {currentQuestionIndex > 0 && (
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={goBackInSurvey}
//               className="absolute top-4 left-4 h-8 w-8 p-0"
//             >
//               <ArrowLeft className="h-4 w-4" />
//             </Button>
//           )}

//           <div className="mb-6">
//             <div className="w-16 h-16 bg-red-700 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
//               <Image
//                 src="/images/butch-cougar.png"
//                 alt="Butch the Cougar"
//                 width={48}
//                 height={48}
//                 className="object-contain"
//               />
//             </div>
//             <h1 className="text-xl font-bold text-foreground mb-2">
//               Welcome, Coug!
//             </h1>
//             <p className="text-sm text-muted-foreground">
//               Let&apos;s personalize your AI companion
//             </p>
//           </div>

//           <div className="mb-8">
//             <div className="flex justify-center mb-4">
//               {SURVEY_QUESTIONS.map((_, index) => (
//                 <div
//                   key={index}
//                   className={`w-2 h-2 rounded-full mx-1 ${
//                     index <= currentQuestionIndex ? 'bg-primary' : 'bg-muted'
//                   }`}
//                 />
//               ))}
//             </div>

//             <h2 className="text-lg font-semibold text-foreground mb-6 text-balance">
//               {currentQuestion.question}
//             </h2>

//             {/* Render based on question type */}
//             {currentQuestion.type === 'slider' ? (
//               <div className="space-y-4 px-2">
//                 <Slider
//                   value={
//                     currentQuestionIndex === 0 ? sliderValue1 : sliderValue2
//                   }
//                   onValueChange={(value) => {
//                     if (currentQuestionIndex === 0) {
//                       setSliderValue1(value)
//                     } else {
//                       setSliderValue2(value)
//                     }
//                   }}
//                   min={currentQuestion.min}
//                   max={currentQuestion.max}
//                   step={currentQuestion.step || 1}
//                   className="w-full"
//                 />
//                 <div className="flex justify-between text-bg text-muted-foreground">
//                   {currentQuestion.labels?.map((label, idx) => (
//                     <span key={idx}>{label}</span>
//                   ))}
//                 </div>
//                 <div className="flex justify-between text-sm font-medium">
//                   <span>
//                     Start:{' '}
//                     {currentQuestionIndex === 0
//                       ? sliderToHourString(sliderValue1[0], 1)
//                       : sliderToHourString(sliderValue2[0], 2)}
//                   </span>
//                   <span>
//                     End:{' '}
//                     {currentQuestionIndex === 0
//                       ? sliderToHourString(sliderValue1[1], 1)
//                       : sliderToHourString(sliderValue2[1], 2)}
//                   </span>
//                 </div>

//                 {/* Validation message for Q2 */}
//                 {currentQuestionIndex === 1 &&
//                   currentQuestion.validation === 'min-7-hours' &&
//                   sliderValue2[1] - sliderValue2[0] < 7 && (
//                     <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
//                       <AlertCircle className="h-4 w-4" />
//                       Consider getting at least 7 hours of sleep
//                     </p>
//                   )}

//                 <Button
//                   onClick={() =>
//                     handleSurveyAnswer(
//                       currentQuestionIndex === 0 ? sliderValue1 : sliderValue2
//                     )
//                   }
//                   className="w-full mt-4"
//                 >
//                   Continue
//                 </Button>
//               </div>
//             ) : showFollowUp ? (
//               <div className="space-y-4">
//                 <p className="text-sm text-muted-foreground mb-2">
//                   Please tell us more about your situation:
//                 </p>
//                 <textarea
//                   value={followUpText}
//                   onChange={(e) => setFollowUpText(e.target.value)}
//                   className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-foreground resize-none"
//                   placeholder="Share any additional details..."
//                 />
//                 <div className="flex gap-2">
//                   <Button
//                     variant="outline"
//                     onClick={() => {
//                       // Skip - submit the answer without notes
//                       handleSurveyAnswer(pendingAnswer)
//                     }}
//                     className="flex-1"
//                   >
//                     Skip
//                   </Button>
//                   <Button onClick={handleFollowUpSubmit} className="flex-1">
//                     Continue
//                   </Button>
//                 </div>
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {currentQuestion.options?.map((option, index) => (
//                   <Button
//                     key={index}
//                     variant="outline"
//                     className=" whitespace-normal w-full text-left justify-start h-auto p-4 hover:bg-primary/10 hover:border-primary transition-all bg-transparent"
//                     onClick={() => handleSurveyAnswer(option)}
//                   >
//                     {option}
//                   </Button>
//                 ))}
//               </div>
//             )}
//           </div>
//         </Card>
//       </div>
//     )
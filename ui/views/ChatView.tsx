// import { DAYS, SCHEDULING_AI } from '@/app/lib/constants'
// import Image from 'next/image'
// import { Button } from '@/ui/components/button.js'
// import {
//   ChevronRight,
//   ArrowLeft,
//   Send,
//   AlertCircle,
// } from 'lucide-react'

// import {isGeneratingSchedule, isUpdatingCalendar, expandedCalendar, scheduleItems, messages, showReturnToHomeButton, error, isLoading, inputText, textareaHasOverflow, textareaRef, messagesEndRef, handleBackToMain, handleTextareaInput, handleKeyPress, handleSendMessage } from '../app/page.tsx'

// const ChatView = () => {
// return (
//       <div className="h-screen bg-background flex flex-col max-w-md mx-auto relative">
//         {/* Loading Overlay */}
//         {isGeneratingSchedule && (
//           <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
//             <div className="bg-card rounded-2xl p-8 shadow-2xl border border-border flex flex-col items-center gap-4">
//               <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
//               <div className="text-center">
//                 <h3 className="font-semibold text-lg text-foreground mb-1">
//                   Generating Your Schedule
//                 </h3>
//                 <p className="text-sm text-muted-foreground">
//                   Analyzing your conversation with Fred...
//                 </p>
//               </div>
//             </div>
//           </div>
//         )}

//         <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-muted/40 to-muted/20 border-b border-border/50 flex-shrink-0">
//           <Button
//             variant="ghost"
//             size="sm"
//             onClick={handleBackToMain}
//             className="h-8 w-8 p-0"
//           >
//             <ArrowLeft className="h-4 w-4" />
//           </Button>
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-full bg-red-700 flex items-center justify-center overflow-hidden">
//               <Image
//                 src="/images/butch-cougar.png"
//                 alt="Butch the Cougar"
//                 width={32}
//                 height={32}
//                 className="object-contain"
//               />
//             </div>
//             <div>
//               <h1 className="font-semibold text-foreground">
//                 {SCHEDULING_AI.name}
//               </h1>
//               <p className="text-sm text-muted-foreground">
//                 {SCHEDULING_AI.description}
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Chat Calendar - Live schedule preview - Expandable */}
//         <div className={`border-b border-border/50 bg-muted/20 flex flex-col ${expandedCalendar ? 'flex-1' : 'flex-shrink-0'}`} style={expandedCalendar ? { height: 'auto' } : { maxHeight: '30vh' }}>
//           <div className="flex items-center justify-between px-3 py-2">
//             <div className="flex items-center gap-2">
//               <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This Week's Schedule</h3>
//               {isUpdatingCalendar && (
//                 <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
//               )}
//             </div>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={() => setExpandedCalendar(!expandedCalendar)}
//               className="h-6 w-6 p-0"
//             >
//               <ChevronRight className={`h-4 w-4 transition-transform ${expandedCalendar ? 'rotate-90' : ''}`} />
//             </Button>
//           </div>
//           <div className="px-3 pb-3 overflow-y-auto flex-1" style={expandedCalendar ? {} : { maxHeight: 'calc(30vh - 2.5rem)' }}>
//             <div className="grid grid-cols-7 gap-1 text-xs">
//               {DAYS.map((day, index) => {
//                 const daySchedule = scheduleItems[day] || []
//                 const todayDate = new Date()
//                 const currentDayOfWeek = (todayDate.getDay() + 6) % 7 // Convert Sunday=0 to Monday=0
//                 const isToday = index === currentDayOfWeek
                
//                 return (
//                   <div key={day} className={`flex flex-col gap-1 ${isToday ? 'bg-primary/10 rounded-lg p-1' : ''}`}>
//                     <div className={`font-semibold text-center pb-1 border-b ${isToday ? 'border-primary text-primary' : 'border-border/30 text-foreground'}`}>
//                       {day}
//                     </div>
//                     <div className="space-y-1 pt-1">
//                       {daySchedule.length === 0 ? (
//                         <div className="text-muted-foreground/50 text-center py-2">-</div>
//                       ) : expandedCalendar ? (
//                         // Show all items when expanded
//                         daySchedule.map((item) => (
//                           <div
//                             key={item.id}
//                             className="bg-card border border-border/50 rounded p-1.5 hover:bg-gray-300 transition-colors cursor-pointer"
//                             title={`${item.title}\n${item.time || 'No time set'}`}
//                           >
//                             <div className="font-medium text-[10px] leading-tight break-words">
//                               {item.title}
//                             </div>
//                             {item.time && (
//                               <div className="text-muted-foreground text-[9px] leading-tight mt-0.5">
//                                 {item.time}
//                               </div>
//                             )}
//                           </div>
//                         ))
//                       ) : (
//                         // Show first 4 items when collapsed
//                         daySchedule.slice(0, 4).map((item) => (
//                           <div
//                             key={item.id}
//                             className="bg-card border border-border/50 rounded p-1.5 hover:bg-gray-300 transition-colors cursor-pointer"
//                             title={`${item.title}\n${item.time || 'No time set'}`}
//                           >
//                             <div className="font-medium truncate text-[10px] leading-tight">
//                               {item.title}
//                             </div>
//                             {item.time && (
//                               <div className="text-muted-foreground text-[9px] truncate leading-tight mt-0.5">
//                                 {item.time.split(' - ')[0]}
//                               </div>
//                             )}
//                           </div>
//                         ))
//                       )}
//                       {!expandedCalendar && daySchedule.length > 4 && (
//                         <div className="text-muted-foreground/70 text-center text-[9px] pt-1">
//                           +{daySchedule.length - 4} more
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 )
//               })}
//             </div>
//           </div>
//         </div>

//         <div className={`${expandedCalendar ? 'hidden' : 'flex-1'} overflow-y-auto p-4 space-y-4 min-h-0`}>
//           {messages.map((message) => (
//             <div
//               key={message.id}
//               className={`flex ${
//                 (message.role as string) === 'user'
//                   ? 'justify-end'
//                   : 'justify-start'
//               }`}
//             >
//               <div className="flex items-start gap-3 max-w-[80%]">
//                 {(message.role as string) === 'assistant' && (
//                   <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
//                     <Image
//                       src="/images/butch-cougar.png"
//                       alt="Fred the Cougar"
//                       width={24}
//                       height={24}
//                       className="object-contain"
//                     />
//                   </div>
//                 )}
//                 <div
//                   className={`rounded-2xl px-4 py-3 ${
//                     (message.role as string) === 'user'
//                       ? 'bg-primary text-primary-foreground ml-auto'
//                       : 'bg-muted text-foreground'
//                   }`}
//                 >
//                   <div className="text-sm leading-relaxed whitespace-pre-wrap">
//                     {(message as { content?: string }).content ||
//                       message.parts?.map((part, index) => {
//                         if (part.type === 'text') {
//                           return <span key={index}>{part.text}</span>
//                         }
//                         return null
//                       })}
//                   </div>
//                 </div>
//                 {(message.role as string) === 'user' && (
//                   <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
//                     <span className="text-sm font-medium">You</span>
//                   </div>
//                 )}
//               </div>
//             </div>
//           ))}

//           {/* Big red button to return to home when onboarding is complete */}
//           {showReturnToHomeButton && (
//             <div className="flex justify-center py-4">
//               <Button
//                 size="lg"
//                 onClick={handleBackToMain}
//                 className="w-full max-w-sm bg-red-600 hover:bg-red-700 text-white font-bold text-lg py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
//               >
//                 ← View your schedule
//               </Button>
//             </div>
//           )}

//           {/* Error display */}
//           {error && (
//             <div className="flex justify-center">
//               <div className="rounded-2xl px-4 py-3 bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-100 border border-red-200 dark:border-red-800">
//                 <div className="flex items-center gap-2">
//                   <AlertCircle className="h-4 w-4" />
//                   <span className="text-sm">{error.message}</span>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Loading indicator when AI is thinking */}
//           {isLoading && (
//             <div className="flex justify-start">
//               <div className="flex items-start gap-3 max-w-[80%]">
//                 <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
//                   <Image
//                     src="/images/butch-cougar.png"
//                     alt="Butch the Cougar"
//                     width={24}
//                     height={24}
//                     className="object-contain"
//                   />
//                 </div>
//                 <div className="rounded-2xl px-4 py-3 bg-muted text-foreground">
//                   <div className="flex items-center gap-2">
//                     <div className="flex space-x-1">
//                       <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
//                       <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
//                       <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
//                     </div>
//                     <span className="text-sm text-muted-foreground">
//                       Fred is thinking...
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           )}
//           <div ref={messagesEndRef} />
//         </div>

//         <div className="p-4 border-t border-border/50 bg-background flex-shrink-0">
//           <div className="flex items-end gap-2">
//             <div className="flex flex-1 relative">
//               <textarea
//                 ref={textareaRef}
//                 value={inputText}
//                 maxLength={300}
//                 onChange={handleTextareaInput}
//                 onKeyPress={handleKeyPress}
//                 placeholder={
//                   isLoading
//                     ? 'Fred is thinking...'

//                     : 'Message Fred the Lion...'

//                 }
//                 disabled={isLoading}
//                 className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
//                 rows={1}
//               />
//               <Button
//                 onClick={handleSendMessage}
//                 disabled={!inputText.trim() || isLoading}
//                 size="sm"
//                 className={`absolute ${textareaHasOverflow ? 'right-5' : 'right-2'} bottom-2 h-8 w-8 p-0 rounded-full`}
//               >
//                 <Send className="h-4 w-4" />
//               </Button>
//             </div>
//           </div>
//         </div>
//       </div>
//     )
// }

// export default ChatView
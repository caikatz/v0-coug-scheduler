// return (
//     <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
//       <div className="bg-gradient-to-r from-muted/40 to-muted/20 rounded-3xl p-6 mb-6 border border-border/50 shadow-lg relative">
//         <h3 className="text-sm font-semibold text-foreground mb-4 text-center">
//           AI Scheduling Assistant
//         </h3>
//         <div className="flex justify-center">
//           <button
//             onClick={handleFredClick}
//             className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-background/60 transition-all duration-300 group hover:scale-105 active:scale-95"
//           >
//             <div className="relative">
//               <div className="w-20 h-20 rounded-full bg-red-700 flex items-center justify-center shadow-xl group-hover:shadow-2xl transition-all duration-300 border-2 border-white/20 overflow-hidden">
//                 <Image
//                   src="/images/butch-cougar.png"
//                   alt="Butch the Cougar"
//                   width={64}
//                   height={64}
//                   className="object-contain"
//                 />
//               </div>
//               <div className="absolute -top-1 -right-1 text-xl">🐾</div>
//             </div>
//             <div className="text-center">
//               <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
//                 {SCHEDULING_AI.name}
//               </div>
//               <div className="text-sm text-muted-foreground">
//                 {SCHEDULING_AI.description}
//               </div>
//             </div>
//           </button>
//         </div>
//       </div>

//       <div className="flex items-center justify-between mb-6">
//         <div>
//           <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
//           <p className="text-muted-foreground">
//             {MONTHS[currentDateObj.getMonth()]} {currentDateObj.getFullYear()}
//           </p>
//         </div>
//         <div className="flex items-center gap-2">
//           <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
//             <DialogTrigger asChild>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 className="h-auto px-2 py-1 text-primary hover:bg-primary/10"
//               >
//                 <Calendar className="h-4 w-4 mr-1" />
//                 Calendar
//               </Button>
//             </DialogTrigger>
//             <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))] overflow-hidden">
//               <DialogHeader>
//                 <DialogTitle>Sync Calendar</DialogTitle>
//                 <DialogDescription className="break-words">
//                   Add your iCal/ICS feed URL to pull events into your schedule.
//                   Works with Google Calendar, Outlook, Apple Calendar, and more.
//                 </DialogDescription>
//               </DialogHeader>
//               <div className="space-y-4 py-4 min-w-0 overflow-hidden">
//                 <div className="flex gap-2 min-w-0">
//                   <input
//                     type="url"
//                     placeholder="https://calendar.google.com/calendar/ical/..."
//                     value={icsInputValue}
//                     onChange={(e) => setIcsInputValue(e.target.value)}
//                     onKeyDown={(e) =>
//                       e.key === 'Enter' && (e.preventDefault(), handleAddCalendarUrl())
//                     }
//                     className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
//                   />
//                   <Button
//                     type="button"
//                     variant="secondary"
//                     onClick={handleAddCalendarUrl}
//                     disabled={!icsInputValue.trim()}
//                   >
//                     Add
//                   </Button>
//                 </div>
//                 {icsUrls.length > 0 && (
//                   <div className="space-y-2 min-w-0 overflow-hidden">
//                     <p className="text-sm font-medium text-foreground">
//                       Calendar feeds ({icsUrls.length})
//                     </p>
//                     <ul className="space-y-2 max-h-32 overflow-y-auto min-w-0">
//                       {icsUrls.map((url) => (
//                         <li
//                           key={url}
//                           className="flex items-center justify-between gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 min-w-0"
//                         >
//                           <span className="flex-1 min-w-0 break-all">
//                             {url}
//                           </span>
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
//                             onClick={() => handleRemoveCalendarUrl(url)}
//                           >
//                             <Trash2 className="h-3.5 w-3.5" />
//                           </Button>
//                         </li>
//                       ))}
//                     </ul>
//                   </div>
//                 )}
//                 {calendarSyncError && (
//                   <p className="text-sm text-destructive">{calendarSyncError}</p>
//                 )}
//               </div>
//               <DialogFooter>
//                 <Button
//                   variant="outline"
//                   onClick={() => setShowCalendarDialog(false)}
//                 >
//                   Cancel
//                 </Button>
//                 <Button
//                   onClick={handleSyncCalendar}
//                   disabled={isSyncingCalendar || icsUrls.length === 0}
//                 >
//                   {isSyncingCalendar ? (
//                     <>
//                       <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//                       Syncing...
//                     </>
//                   ) : (
//                     'Sync Calendar'
//                   )}
//                 </Button>
//               </DialogFooter>
//             </DialogContent>
//           </Dialog>
//           <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
//             <DialogTrigger asChild>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 className="h-auto px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
//               >
//                 <RotateCcw className="h-4 w-4 mr-1" />
//                 Reset
//               </Button>
//             </DialogTrigger>
//           <DialogContent>
//             <DialogHeader>
//               <DialogTitle>Reset All Data</DialogTitle>
//               <DialogDescription>
//                 This will permanently delete all your schedule data,
//                 preferences, and chat history. This action cannot be undone.
//               </DialogDescription>
//             </DialogHeader>
//             <DialogFooter>
//               <Button
//                 variant="outline"
//                 onClick={() => setShowResetDialog(false)}
//               >
//                 Cancel
//               </Button>
//               <Button variant="destructive" onClick={handleReset}>
//                 Reset All Data
//               </Button>
//             </DialogFooter>
//           </DialogContent>
//         </Dialog>
//         </div>
//       </div>

//       {/* Calendar */}
//       <Card className="mb-6 p-4">
//         <div className="flex items-center justify-center mb-4">
//           <div className="flex items-center gap-1">
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={() => navigateWeek('prev')}
//               className="h-8 w-8 p-0"
//             >
//               <ChevronLeft className="h-4 w-4" />
//             </Button>
//             <span className="font-medium text-foreground">
//               Week of {weekDates[0].getDate()} - {weekDates[6].getDate()}
//             </span>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={() => navigateWeek('next')}
//               className="h-8 w-8 p-0"
//             >
//               <ChevronRight className="h-4 w-4" />
//             </Button>
//           </div>
//         </div>

//         <div className="grid grid-cols-7 gap-2">
//           {DAYS.map((day, index) => {
//             const date = weekDates[index]
//             const isSelected = selectedDay === index
//             const isToday = date.toDateString() === new Date().toDateString()
//             const dateString = formatDateLocal(date)

//             // Filter tasks for this specific date, same logic as task display
//             const dayTasks = (scheduleItems[day] || []).filter((item) => {
//               // If task has no due date, show it (legacy behavior)
//               if (!item.dueDate) {
//                 return true
//               }
//               // Only count tasks whose due date matches this specific date
//               return item.dueDate === dateString
//             })
//             const hasActiveTasks = dayTasks.length > 0

//             return (
//               <button
//                 key={day}
//                 onClick={() => setSelectedDay(index)}
//                 className={`p-3 rounded-lg text-center transition-all ${
//                   isSelected
//                     ? 'bg-primary text-primary-foreground'
//                     : isToday
//                     ? 'bg-primary/10 text-primary border-2 border-primary/20'
//                     : 'hover:bg-muted'
//                 }`}
//               >
//                 <div className="text-xs font-medium">{day}</div>
//                 <div className="text-lg font-bold mt-1">{date.getDate()}</div>
//                 <div className="flex justify-center mt-1">
//                   <div
//                     className={`w-2 h-2 rounded-full transition-colors ${
//                       hasActiveTasks ? 'bg-primary' : 'bg-transparent'
//                     }`}
//                   />
//                 </div>
//               </button>
//             )
//           })}
//         </div>
//       </Card>

//       <div className="mb-20">
//         <div className="flex items-center justify-between mb-3">
//           <h2 className="text-lg font-semibold text-foreground">
//             {DAYS[selectedDay]}&apos;s Schedule
//           </h2>
//           <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
//             <Button
//               variant={viewMode === 'cards' ? 'default' : 'ghost'}
//               size="sm"
//               onClick={() => setViewMode('cards')}
//               className="h-8 w-8 p-0"
//             >
//               <Grid3X3 className="h-4 w-4" />
//             </Button>
//             <Button
//               variant={viewMode === 'todo' ? 'default' : 'ghost'}
//               size="sm"
//               onClick={() => setViewMode('todo')}
//               className="h-8 w-8 p-0"
//             >
//               <List className="h-4 w-4" />
//             </Button>
//           </div>
//         </div>
//         {viewMode === 'cards' ? (
//           // Card View (original layout)
//           <div className="space-y-3">
//             {currentScheduleItems.map((item) => (
//               <Card
//                 key={item.id}
//                 className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
//                 onClick={() => handleTaskClick(item)}
//               >
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center gap-3 flex-1">
//                     <button
//                       className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${
//                         item.completed
//                           ? 'bg-primary border-primary'
//                           : 'border-muted-foreground hover:border-primary'
//                       }`}
//                       onClick={(e) => {
//                         e.stopPropagation()
//                         handleTaskCompletion(item.id, DAYS[selectedDay])
//                       }}
//                     />
//                     <div className="flex-1">
//                       <h3
//                         className={`font-medium ${
//                           item.completed
//                             ? 'line-through text-muted-foreground'
//                             : 'text-foreground'
//                         }`}
//                       >
//                         {item.title}
//                       </h3>
//                       <p className="text-sm text-muted-foreground">
//                         {item.time || 'No specific time'}
//                       </p>
//                     </div>
//                   </div>
//                   <div className="flex items-center gap-2">
//                     {getPriorityIcon(item.priority)}
//                   </div>
//                 </div>
//               </Card>
//             ))}

//             {currentScheduleItems.length === 0 && (
//               <Card className="p-6 text-center">
//                 <p className="text-muted-foreground">
//                   No scheduled items for this day
//                 </p>
//               </Card>
//             )}
//           </div>
//         ) : (
//           // TODO List View (compact line-item style)
//           <div className="space-y-2">
//             {currentScheduleItems.map((item) => (
//               <div
//                 key={item.id}
//                 className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
//                 onClick={() => handleTaskClick(item)}
//               >
//                 <button
//                   className={`w-4 h-4 rounded border-2 transition-all hover:scale-110 flex items-center justify-center ${
//                     item.completed
//                       ? 'bg-primary border-primary text-primary-foreground'
//                       : 'border-muted-foreground hover:border-primary'
//                   }`}
//                   onClick={(e) => {
//                     e.stopPropagation()
//                     handleTaskCompletion(item.id, DAYS[selectedDay])
//                   }}
//                 >
//                   {item.completed && (
//                     <svg
//                       className="w-2.5 h-2.5"
//                       viewBox="0 0 20 20"
//                       fill="currentColor"
//                     >
//                       <path
//                         fillRule="evenodd"
//                         d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
//                         clipRule="evenodd"
//                       />
//                     </svg>
//                   )}
//                 </button>
//                 <div className="flex-1 min-w-0">
//                   <span
//                     className={`font-medium truncate ${
//                       item.completed
//                         ? 'line-through text-muted-foreground'
//                         : 'text-foreground'
//                     }`}
//                   >
//                     {item.title}
//                   </span>
//                 </div>
//               </div>
//             ))}

//             {currentScheduleItems.length === 0 && (
//               <div className="p-6 text-center rounded-lg border border-dashed border-border/50">
//                 <p className="text-muted-foreground">
//                   No scheduled items for this day
//                 </p>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 p-4 z-10">
//         <div className="max-w-md mx-auto">
//           <Button
//             className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-3 font-semibold shadow-lg"
//             onClick={(e) => {
//               e.preventDefault()
//               e.stopPropagation()
//               setEditingTask(null)
//               setTaskFormErrors([])
//               setTaskForm({
//                 name: '',
//                 startTime: '',
//                 endTime: '',
//                 dueDate: '',
//                 priority: 'medium',
//                 repeatType: 'never',
//                 repeatDays: [],
//               })
//               setShowTaskEditor(true)
//             }}
//           >
//             <Plus className="w-5 h-5 mr-2" />
//             Add Task to Schedule
//           </Button>
//         </div>
//       </div>
//     </div>
//   )
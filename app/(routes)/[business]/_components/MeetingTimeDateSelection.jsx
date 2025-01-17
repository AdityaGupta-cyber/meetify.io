import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { CalendarCheck, Clock, LoaderIcon, MapPin, Timer } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import TimeDateSelection from './TimeDateSelection'
import UserFormInfo from './UserFormInfo'
import { collection, doc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore'
import { app } from '@/config/FirebaseConfig'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Plunk from '@plunk/node'
import { render } from '@react-email/render'
import Email from '@/emails'

function MeetingTimeDateSelection({ eventInfo, businessInfo }) {
    const [date, setDate] = useState(new Date())
    const [timeSlots, setTimeSlots] = useState([])
    const [enableTimeSlot, setEnabledTimeSlot] = useState(false)
    const [selectedTime, setSelectedTime] = useState('')
    const [userName, setUserName] = useState('')
    const [userEmail, setUserEmail] = useState('')
    const [userNote, setUserNote] = useState('')
    const [prevBooking, setPrevBooking] = useState([])
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    const router = useRouter()
    const db = getFirestore(app)
    const plunk = new Plunk(process.env.NEXT_PUBLIC_PLUNK_API_KEY)

    useEffect(() => {
        if (eventInfo?.duration) {
            createTimeSlot(eventInfo.duration)
        }
    }, [eventInfo])

    const createTimeSlot = (interval) => {
        const startTime = 8 * 60 // 8 AM in minutes
        const endTime = 22 * 60 // 10 PM in minutes
        const totalSlots = (endTime - startTime) / interval
        const slots = Array.from({ length: totalSlots }, (_, i) => {
            const totalMinutes = startTime + i * interval
            const hours = Math.floor(totalMinutes / 60)
            const minutes = totalMinutes % 60
            const formattedHours = hours % 12 || 12 // Convert to 12-hour format, ensuring 12 is handled correctly
            const period = hours >= 12 ? 'PM' : 'AM'
            return `${String(formattedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`
        })

        console.log(slots)
        setTimeSlots(slots)
    }

    const handleDateChange = (newDate) => {
        if (newDate instanceof Date && !isNaN(newDate.getTime())) {
            setDate(newDate)
            const day = format(newDate, 'EEEE')
            if (businessInfo?.daysAvailable?.[day]) {
                getPrevEventBooking(newDate)
                setEnabledTimeSlot(true)
            } else {
                setEnabledTimeSlot(false)
            }
        } else {
            console.error('Invalid date passed to handleDateChange')
        }
    }

    const handleScheduleEvent = async () => {
        if (!date || isNaN(date.getTime())) {
            toast('Invalid date')
            return
        }

        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/
        if (!regex.test(userEmail)) {
            toast('Enter valid email address')
            return
        }

        const docId = Date.now().toString()
        setLoading(true)
        try {
            await setDoc(doc(db, 'ScheduledMeetings', docId), {
                businessName: businessInfo.businessName,
                businessEmail: businessInfo.email,
                selectedTime: selectedTime,
                selectedDate: date,
                formattedDate: format(date, 'PPP'),
                formattedTimeStamp: format(date, 't'),
                duration: eventInfo.duration,
                locationUrl: eventInfo.locationUrl,
                eventId: eventInfo.id,
                id: docId,
                userName: userName,
                userEmail: userEmail,
                userNote: userNote
            })
            toast('Meeting Scheduled successfully!')
            sendEmail(userName)
        } catch (error) {
            console.error('Error scheduling event:', error)
            toast('Error scheduling event')
        } finally {
            setLoading(false)
        }
    }

    const sendEmail = (user) => {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            console.error('Invalid date in sendEmail')
            return
        }

        const emailHtml = render(
            <Email
                businessName={businessInfo?.businessName}
                date={format(date, 'PPP')}
                duration={eventInfo?.duration}
                meetingTime={selectedTime}
                meetingUrl={eventInfo.locationUrl}
                userFirstName={user}
            />
        )

        plunk.emails.send({
            to: userEmail,
            subject: 'Meeting Schedule Details',
            body: emailHtml,
        }).then(resp => {
            console.log(resp)
            router.replace('/confirmation')
        }).catch(error => {
            console.error('Error sending email:', error)
            toast('Error sending email')
        })
    }

    const getPrevEventBooking = async (date_) => {
        if (!(date_ instanceof Date) || isNaN(date_.getTime())) {
            console.error('Invalid date in getPrevEventBooking')
            return
        }

        const q = query(
            collection(db, 'ScheduledMeetings'),
            where('selectedDate', '==', date_),
            where('eventId', '==', eventInfo.id)
        )

        try {
            const querySnapshot = await getDocs(q)
            const bookings = []
            querySnapshot.forEach((doc) => {
                bookings.push(doc.data())
            })
            setPrevBooking(bookings)
        } catch (error) {
            console.error('Error fetching previous bookings:', error)
            toast('Error fetching previous bookings')
        }
    }

    return (
        <div className='p-5 py-10 shadow-lg m-5 border-t-8
        mx-10
        md:mx-26
        lg:mx-56
        my-10'
            style={{ borderTopColor: eventInfo?.themeColor }}
        >
            <h1 className='text-primary text-3xl'>Meetify.io</h1>
            <div className='grid grid-cols-1 md:grid-cols-3 mt-5'>
                {/* Meeting Info */}
                <div className='p-4 border-r'>
                    <h2>{businessInfo?.businessName}</h2>
                    <h2 className='font-bold text-3xl'>
                        {eventInfo?.eventName ? eventInfo?.eventName : 'Meeting Name'}
                    </h2>
                    <div className='mt-5 flex flex-col gap-4'>
                        <h2 className='flex gap-2'><Clock />{eventInfo?.duration} Min</h2>
                        <h2 className='flex gap-2'><MapPin />{eventInfo?.locationType} Meeting</h2>
                        <h2 className='flex gap-2'><CalendarCheck />{date && !isNaN(date.getTime()) ? format(date, 'PPP') : 'Invalid Date'}</h2>
                        {selectedTime && <h2 className='flex gap-2'><Timer />{selectedTime}</h2>}
                        <Link href={eventInfo?.locationUrl ? eventInfo?.locationUrl : '#'}
                            className='text-primary'
                        >{eventInfo?.locationUrl}</Link>
                    </div>
                </div>
                {/* Time & Date Selection */}
                {step === 1 ? (
                    <TimeDateSelection
                        date={date}
                        enableTimeSlot={enableTimeSlot}
                        handleDateChange={handleDateChange}
                        setSelectedTime={setSelectedTime}
                        timeSlots={timeSlots}
                        selectedTime={selectedTime}
                        prevBooking={prevBooking}
                    />
                ) : (
                    <UserFormInfo
                        setUserName={setUserName}
                        setUserEmail={setUserEmail}
                        setUserNote={setUserNote}
                    />
                )}
            </div>
            <div className='flex gap-3 justify-end'>
                {step === 2 && <Button variant="outline" onClick={() => setStep(1)}>Back</Button>}
                {step === 1 ? (
                    <Button className="mt-10 float-right"
                        disabled={!selectedTime || !date}
                        onClick={() => setStep(step + 1)}
                    >Next</Button>
                ) : (
                    <Button disabled={!userEmail || !userName}
                        onClick={handleScheduleEvent}
                    >
                        {loading ? <LoaderIcon className='animate-spin' /> : 'Schedule'}
                    </Button>
                )}
            </div>
        </div>
    )
}

export default MeetingTimeDateSelection

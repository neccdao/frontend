import React, { Fragment, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";

export default function Modal(props) {
  const { isVisible, setIsVisible, className } = props;
  let refDiv = useRef(null);
  return (
    <Transition appear show={isVisible} as={Fragment}>
      <Dialog
        initialFocus={refDiv}
        as="div"
        className="fixed inset-0 z-10 overflow-y-auto"
        onClose={() => setIsVisible(false)}
      >
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-nord2 opacity-60" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="inline-block min-h-screen align-middle"
            aria-hidden="true"
          >
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div
              className={`inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-nord1 shadow-xl rounded-2xl border-2 border-solid border-nord3 ${className}`}
            >
              <Dialog.Title as="h3" className="text-2xl font-bold text-white">
                {props.label}
              </Dialog.Title>
              <div ref={refDiv} className="w-100 h-[2px] bg-white mb-6"></div>
              {props.children}
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
